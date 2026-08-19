"use strict";

/**
 * Document parser service.
 *
 * Turns a binary file buffer + mime type into a PageIndex-style hierarchical tree:
 *
 *     root (DOCUMENT)
 *       ├── section (SECTION)            heading="1. Introduction"
 *       │     ├── chunk (CHUNK)          verbatim text, ~700 chars
 *       │     └── chunk (CHUNK)
 *       └── section (SECTION)            heading="2. Functional Requirements"
 *             └── subsection (SECTION)   heading="2.1 Authentication"
 *                   └── chunk (CHUNK)
 *
 * No vector embeddings are produced — the rag-service walks the tree using headings
 * and short summaries (vectorless RAG).
 *
 * The function `parse(fileBuffer, mimeType, originalFilename, opts)` returns:
 *   { nodes: [...flat array of tree nodes...], pageCount, leafCount }
 *
 * Each node:
 *   {
 *     node_id, parent_node_id, children_node_ids[], depth,
 *     node_type: "DOCUMENT" | "SECTION" | "CHUNK",
 *     section_path, heading, page_number, order_index,
 *     content, summary, token_count, char_count, metadata
 *   }
 *
 * Heavy parsers (pdf-parse, mammoth, xlsx, node-html-parser, marked) are lazy-required
 * so a missing optional dep doesn't break the service at startup.
 */

const path = require("path");

// ---------- chunking primitives ----------

const TARGET_CHUNK_CHARS = 1200; // ~250 tokens
const MAX_CHUNK_CHARS = 1800;

function approxTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function summarize(text, limit = 280) {
  if (!text) return "";
  const single = text.replace(/\s+/g, " ").trim();
  if (single.length <= limit) return single;
  return single.slice(0, limit - 1) + "…";
}

function splitIntoChunks(text, target = TARGET_CHUNK_CHARS, hard = MAX_CHUNK_CHARS) {
  const cleaned = (text || "").replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  if (!cleaned) return [];
  if (cleaned.length <= target) return [cleaned];

  const paragraphs = cleaned.split(/\n\s*\n+/);
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  for (const p of paragraphs) {
    const para = p.trim();
    if (!para) continue;
    if ((current + "\n\n" + para).length <= target) {
      current = current ? current + "\n\n" + para : para;
    } else if (para.length <= hard) {
      flush();
      current = para;
    } else {
      flush();
      // sentence-split overlong paragraph
      const sentences = para.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
      let buf = "";
      for (const s of sentences) {
        if ((buf + " " + s).length > target && buf) {
          chunks.push(buf.trim());
          buf = s;
        } else {
          buf = buf ? buf + " " + s : s;
        }
        if (buf.length > hard) {
          chunks.push(buf.trim());
          buf = "";
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
    }
  }
  flush();
  return chunks;
}

// ---------- tree builders ----------

/**
 * Build a tree from an array of { level, heading, text, pageNumber? } sections.
 * `level` starts at 1; `text` is the section body (will be chunked further).
 */
function buildTreeFromSections({ rootHeading, sections, defaultPage = null }) {
  const nodes = [];
  const rootId = "0";
  const root = {
    node_id: rootId,
    parent_node_id: null,
    children_node_ids: [],
    depth: 0,
    node_type: "DOCUMENT",
    section_path: rootHeading || "",
    heading: rootHeading || "",
    page_number: null,
    order_index: 0,
    content: "",
    summary: "",
    token_count: 0,
    char_count: 0,
    metadata: {},
  };
  nodes.push(root);

  // stack carries the current ancestor section node at each level
  const stack = [{ level: 0, node: root }];
  let nextSerial = 1;

  for (const sec of sections) {
    while (stack.length > 1 && stack[stack.length - 1].level >= sec.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    const nodeId = String(nextSerial++);
    parent.children_node_ids.push(nodeId);

    const sectionPath = parent.section_path
      ? parent.section_path + " > " + sec.heading
      : sec.heading;

    const sectionNode = {
      node_id: nodeId,
      parent_node_id: parent.node_id,
      children_node_ids: [],
      depth: (parent.depth || 0) + 1,
      node_type: "SECTION",
      section_path: sectionPath,
      heading: sec.heading || "",
      page_number: sec.pageNumber || defaultPage,
      order_index: parent.children_node_ids.length - 1,
      content: "",
      summary: summarize(sec.text || sec.heading || ""),
      token_count: 0,
      char_count: 0,
      metadata: sec.metadata || {},
    };
    nodes.push(sectionNode);
    stack.push({ level: sec.level, node: sectionNode });

    // chunk the section body
    const chunks = splitIntoChunks(sec.text || "");
    chunks.forEach((chunkText, idx) => {
      const chunkId = String(nextSerial++);
      sectionNode.children_node_ids.push(chunkId);
      const chunkNode = {
        node_id: chunkId,
        parent_node_id: sectionNode.node_id,
        children_node_ids: [],
        depth: sectionNode.depth + 1,
        node_type: "CHUNK",
        section_path: sectionPath,
        heading: sec.heading || "",
        page_number: sec.pageNumber || defaultPage,
        order_index: idx,
        content: chunkText,
        summary: summarize(chunkText),
        token_count: approxTokenCount(chunkText),
        char_count: chunkText.length,
        metadata: {},
      };
      nodes.push(chunkNode);
    });
  }

  // build a coarse root summary from the first few children
  const childSummaries = nodes
    .filter((n) => n.parent_node_id === rootId)
    .slice(0, 8)
    .map((n) => n.heading)
    .filter(Boolean);
  root.summary = summarize(
    (rootHeading ? rootHeading + ". " : "") + childSummaries.join(" — ")
  );

  return nodes;
}

// ---------- text / markdown ----------

function parseHeadingLevel(line) {
  // Markdown #, ##, ### / numbered "1." or "1.2.3 " headings
  const md = line.match(/^(#{1,6})\s+(.+)$/);
  if (md) return { level: md[1].length, heading: md[2].trim() };

  const numbered = line.match(/^([0-9]+(?:\.[0-9]+){0,5})\.?\s+(.+)$/);
  if (numbered) {
    const dots = numbered[1].split(".").filter(Boolean).length;
    return { level: Math.min(dots, 6), heading: numbered[2].trim() };
  }

  // UPPER CASE short line (heuristic for legacy specs)
  if (
    /^[A-Z0-9][A-Z0-9 \-:_/]{3,80}$/.test(line.trim()) &&
    line.trim().length < 90 &&
    !line.trim().endsWith(".")
  ) {
    return { level: 2, heading: line.trim() };
  }
  return null;
}

function sectionsFromPlainText(text) {
  const lines = (text || "").split(/\r?\n/);
  const sections = [];
  let current = null;

  const flush = () => {
    if (current) {
      current.text = current.text.trim();
      sections.push(current);
    }
  };

  for (const line of lines) {
    if (!line.trim()) {
      if (current) current.text += "\n";
      continue;
    }
    const h = parseHeadingLevel(line);
    if (h) {
      flush();
      current = { level: h.level, heading: h.heading, text: "" };
    } else {
      if (!current) {
        current = { level: 1, heading: "Body", text: "" };
      }
      current.text += line + "\n";
    }
  }
  flush();

  if (sections.length === 0 && (text || "").trim()) {
    sections.push({ level: 1, heading: "Body", text: text.trim() });
  }
  return sections;
}

async function parsePlainText(buffer, originalFilename) {
  const text = buffer.toString("utf8");
  const sections = sectionsFromPlainText(text);
  const nodes = buildTreeFromSections({
    rootHeading: originalFilename || "Document",
    sections,
  });
  return { nodes, pageCount: null };
}

async function parseMarkdown(buffer, originalFilename) {
  // Markdown can be treated by the plain-text heading parser; #/##/### already work.
  return parsePlainText(buffer, originalFilename);
}

// ---------- PDF ----------

async function parsePdf(buffer, originalFilename) {
  let pdfParse;
  try {
    pdfParse = require("pdf-parse");
  } catch (e) {
    throw new Error("pdf-parse not installed: " + e.message);
  }
  const data = await pdfParse(buffer);
  const sections = sectionsFromPlainText(data.text || "");
  const nodes = buildTreeFromSections({
    rootHeading: originalFilename || "PDF Document",
    sections,
    defaultPage: 1,
  });
  return { nodes, pageCount: data.numpages || null };
}

// ---------- DOCX ----------

async function parseDocx(buffer, originalFilename) {
  let mammoth;
  try {
    mammoth = require("mammoth");
  } catch (e) {
    throw new Error("mammoth not installed: " + e.message);
  }

  // Convert to HTML so we can detect h1..h6 reliably, then walk to sections.
  const result = await mammoth.convertToHtml({ buffer });
  return parseHtmlString(result.value || "", originalFilename || "DOCX Document");
}

// ---------- HTML ----------

function parseHtmlString(html, rootHeading) {
  let parser;
  try {
    parser = require("node-html-parser");
  } catch (e) {
    throw new Error("node-html-parser not installed: " + e.message);
  }
  const root = parser.parse(html || "");
  const blocks = root.querySelectorAll(
    "h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,table"
  );

  const sections = [];
  let current = null;
  for (const el of blocks) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      if (current) sections.push(current);
      current = {
        level: parseInt(tag.slice(1), 10),
        heading: el.text.trim() || "Section",
        text: "",
      };
    } else {
      if (!current) current = { level: 1, heading: rootHeading, text: "" };
      const text = (el.text || "").replace(/\s+\n/g, "\n").trim();
      if (text) current.text += text + "\n\n";
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) {
    const text = root.text || "";
    sections.push({ level: 1, heading: rootHeading, text });
  }

  const nodes = buildTreeFromSections({ rootHeading, sections });
  return { nodes, pageCount: null };
}

async function parseHtml(buffer, originalFilename) {
  return parseHtmlString(
    buffer.toString("utf8"),
    originalFilename || "HTML Document"
  );
}

// ---------- XLSX / CSV ----------

async function parseSpreadsheet(buffer, originalFilename, mimeType) {
  let XLSX;
  try {
    XLSX = require("xlsx");
  } catch (e) {
    throw new Error("xlsx not installed: " + e.message);
  }
  const isCsv =
    /csv/i.test(mimeType || "") || /\.csv$/i.test(originalFilename || "");
  const wb = XLSX.read(buffer, { type: "buffer", raw: false });

  const sections = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    if (rows.length === 0) continue;

    const headerRow = rows[0].map((h) => String(h ?? "").trim());
    const dataRows = rows.slice(1);

    // sheet-level section
    sections.push({
      level: 1,
      heading: isCsv
        ? path.basename(originalFilename || "data.csv")
        : `Sheet: ${sheetName}`,
      text:
        `Columns: ${headerRow.join(", ")}\n` +
        `Rows: ${dataRows.length}\n`,
      metadata: { sheet: sheetName, columns: headerRow },
    });

    // chunk row groups so a tabular doc can also be queried
    const ROW_GROUP = 25;
    for (let i = 0; i < dataRows.length; i += ROW_GROUP) {
      const group = dataRows.slice(i, i + ROW_GROUP);
      const lines = group.map((r) => {
        const cells = r.map((c, idx) => {
          const k = headerRow[idx] || `col_${idx}`;
          const v = c == null ? "" : String(c);
          return `${k}: ${v}`;
        });
        return "- " + cells.join(" | ");
      });
      sections.push({
        level: 2,
        heading: `Rows ${i + 1}–${Math.min(i + ROW_GROUP, dataRows.length)}`,
        text: lines.join("\n"),
        metadata: { sheet: sheetName, row_start: i + 1, row_end: i + group.length },
      });
    }
  }

  const nodes = buildTreeFromSections({
    rootHeading: originalFilename || "Spreadsheet",
    sections,
  });
  return { nodes, pageCount: wb.SheetNames.length };
}

// ---------- dispatcher ----------

function detectKind(mimeType, filename) {
  const lower = (filename || "").toLowerCase();
  const m = (mimeType || "").toLowerCase();

  if (m.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (
    m.includes("wordprocessingml") ||
    m.includes("msword") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".doc")
  ) {
    return "docx";
  }
  if (
    m.includes("spreadsheetml") ||
    m.includes("excel") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv") ||
    m.includes("text/csv")
  ) {
    return "spreadsheet";
  }
  if (m.includes("html") || lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "html";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "markdown";
  }
  if (m.startsWith("text/") || lower.endsWith(".txt")) {
    return "text";
  }
  return "text";
}

async function parse(buffer, mimeType, originalFilename, opts = {}) {
  const kind = opts.kind || detectKind(mimeType, originalFilename);
  let result;
  switch (kind) {
    case "pdf":
      result = await parsePdf(buffer, originalFilename);
      break;
    case "docx":
      result = await parseDocx(buffer, originalFilename);
      break;
    case "spreadsheet":
      result = await parseSpreadsheet(buffer, originalFilename, mimeType);
      break;
    case "html":
      result = await parseHtml(buffer, originalFilename);
      break;
    case "markdown":
      result = await parseMarkdown(buffer, originalFilename);
      break;
    case "text":
    default:
      result = await parsePlainText(buffer, originalFilename);
      break;
  }

  const leafCount = result.nodes.filter((n) => n.node_type === "CHUNK").length;
  return {
    nodes: result.nodes,
    pageCount: result.pageCount || null,
    leafCount,
    kind,
  };
}

module.exports = {
  parse,
  detectKind,
  // exposed for unit-testing
  _internal: {
    splitIntoChunks,
    sectionsFromPlainText,
    buildTreeFromSections,
    summarize,
  },
};
