"use strict";

/**
 * Vectorless RAG service.
 *
 * Implements a **PageIndex-style tree-of-contents traversal** over parsed project documents.
 * Each project document is stored as a tree of nodes (DOCUMENT -> SECTION -> CHUNK) in MongoDB;
 * `selectChunks` walks that tree using heading + summary signals (with a small lexical scorer)
 * and returns the most relevant CHUNK nodes.
 *
 * There is *no* vector store, no embedding model dependency, and no LLM dependency at the
 * boundary of this module — the only required input is the user query string. An optional
 * `llmRouter` hook is exposed so a future ai_engine integration can replace the deterministic
 * scorer with an LLM-as-router walk without changing the public API.
 *
 * Public API:
 *   - selectChunks({ projectId, organizationId?, query, docTypes?, projectDocumentIds?,
 *                    topK?, maxBranch?, maxDepth?, llmRouter? })
 *       -> { chunks: [...], traversal: [...], documents: [...] }
 *   - search({ projectId, ... }) - thin alias used by HTTP layer
 */

const projectDocumentFactory = require("../database/mysql/factories/project-document-factory");
const projectDocumentChunkFactory = require("../database/mongodb/factories/project-document-chunk-factory");

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","but","by","for","from","has","have",
  "if","in","into","is","it","its","of","on","or","so","such","than","that",
  "the","then","there","these","they","this","to","was","were","will","with",
  "what","which","who","whom","why","how","when","where","do","does","did",
  "i","you","we","our","your","their","my","please","can","could","should",
  "would","may","might","must","shall","not","no","yes",
]);

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Deterministic lexical scorer used as a stand-in for the LLM router.
 * Counts overlapping tokens between the query and a candidate node's heading/summary,
 * weights short fields slightly higher (heading > summary > content), and rewards multi-token hits.
 */
function scoreNode(node, queryTokens) {
  if (!node || queryTokens.length === 0) return 0;
  const heading = tokenize(node.heading);
  const summary = tokenize(node.summary);
  const path = tokenize(node.section_path);

  let score = 0;
  const seen = new Set();
  for (const t of queryTokens) {
    if (heading.includes(t)) {
      score += 3;
      seen.add(t);
    } else if (path.includes(t)) {
      score += 2;
      seen.add(t);
    } else if (summary.includes(t)) {
      score += 1.5;
      seen.add(t);
    }
  }
  // bonus for hitting multiple distinct tokens
  if (seen.size > 1) score += 0.5 * (seen.size - 1);
  return score;
}

/**
 * Walk one document's tree starting at the root. Returns the top scoring CHUNK nodes
 * along with the traversal path (which sections were "opened").
 */
async function walkDocument({
  projectDocumentId,
  queryTokens,
  maxBranch,
  maxDepth,
  llmRouter,
  perDocChunkLimit,
}) {
  const root = await projectDocumentChunkFactory.getRoot(projectDocumentId);
  if (!root) return { chunks: [], path: [] };

  const collectedChunks = [];
  const path = [];

  async function visit(node, depthSoFar) {
    if (depthSoFar > maxDepth) return;
    path.push({
      node_id: node.node_id,
      heading: node.heading,
      depth: node.depth,
      section_path: node.section_path,
    });

    const children = await projectDocumentChunkFactory.getChildren(
      projectDocumentId,
      node.node_id
    );
    if (!children || children.length === 0) return;

    // separate sections and chunks at this level
    const sections = children.filter((c) => c.node_type === "SECTION");
    const chunks = children.filter((c) => c.node_type === "CHUNK");

    // collect chunks at this level
    for (const ch of chunks) {
      collectedChunks.push({
        ...ch,
        _score: scoreNode(ch, queryTokens) + 0.5, // small floor for any traversed chunk
      });
    }

    if (sections.length === 0) return;

    // rank candidate sub-sections
    const ranked = [];
    for (const sec of sections) {
      let s;
      if (llmRouter) {
        s = await llmRouter({ candidate: sec, queryTokens, parent: node });
      } else {
        s = scoreNode(sec, queryTokens);
      }
      ranked.push({ sec, score: s });
    }
    ranked.sort((a, b) => b.score - a.score);

    // always descend into the top-scoring branches; allow zero-score fallback at root
    const top = ranked
      .filter((r, idx) => r.score > 0 || (depthSoFar === 0 && idx < maxBranch))
      .slice(0, maxBranch);

    for (const { sec } of top) {
      await visit(sec, depthSoFar + 1);
    }
  }

  await visit(root, 0);

  // pick top chunks for this document
  collectedChunks.sort((a, b) => b._score - a._score);
  return { chunks: collectedChunks.slice(0, perDocChunkLimit), path };
}

/**
 * Pick candidate documents (by doc_type / explicit id list) — narrow the universe before walking trees.
 */
async function pickCandidateDocuments({
  projectId,
  organizationId,
  docTypes,
  projectDocumentIds,
  candidateDocLimit,
}) {
  const filters = {
    project_id: Number(projectId),
    status: "INDEXED",
  };
  if (organizationId) filters.organization_id = Number(organizationId);
  if (Array.isArray(docTypes) && docTypes.length > 0) {
    filters.doc_type = docTypes;
  }
  if (Array.isArray(projectDocumentIds) && projectDocumentIds.length > 0) {
    filters.project_document_id = projectDocumentIds;
  }

  const result = await projectDocumentFactory.getByFilter(
    filters,
    [["modified_date", "DESC"]],
    1,
    candidateDocLimit
  );
  return result?.data || [];
}

/**
 * Main entry point.
 */
async function selectChunks({
  projectId,
  organizationId = null,
  query,
  docTypes = null,
  projectDocumentIds = null,
  topK = 8,
  maxBranch = 3,
  maxDepth = 5,
  candidateDocLimit = 25,
  perDocChunkLimit = 4,
  llmRouter = null,
}) {
  if (!projectId) throw new Error("projectId is required");
  if (!query || !query.trim()) {
    return { chunks: [], traversal: [], documents: [] };
  }

  const queryTokens = tokenize(query);

  const candidateDocs = await pickCandidateDocuments({
    projectId,
    organizationId,
    docTypes,
    projectDocumentIds,
    candidateDocLimit,
  });

  // 1) Run PageIndex traversal per candidate document.
  const traversal = [];
  let allChunks = [];
  for (const doc of candidateDocs) {
    const { chunks, path } = await walkDocument({
      projectDocumentId: doc.project_document_id,
      queryTokens,
      maxBranch,
      maxDepth,
      llmRouter,
      perDocChunkLimit,
    });
    if (path.length > 0) {
      traversal.push({
        project_document_id: doc.project_document_id,
        title: doc.title || doc.original_filename,
        doc_type: doc.doc_type,
        path,
      });
    }
    for (const ch of chunks) {
      allChunks.push({
        ...ch,
        project_document_title: doc.title || doc.original_filename,
        project_document_doc_type: doc.doc_type,
      });
    }
  }

  // 2) Lexical fallback: also run a Mongo $text search across the project and merge results
  //    that were missed by tree traversal. Tree-walked hits keep their score boost.
  try {
    const textHits = await projectDocumentChunkFactory.textSearch({
      projectId,
      organizationId,
      docTypes,
      projectDocumentIds,
      query,
      limit: topK * 2,
    });
    const seen = new Set(
      allChunks.map((c) => `${c.project_document_id}#${c.node_id}`)
    );
    for (const hit of textHits) {
      const key = `${hit.project_document_id}#${hit.node_id}`;
      if (!seen.has(key)) {
        allChunks.push({
          ...hit,
          _score:
            (typeof hit.score === "number" ? hit.score : 1) +
            scoreNode(hit, queryTokens) * 0.5,
        });
        seen.add(key);
      }
    }
  } catch (e) {
    // Mongo $text index may not exist on legacy installs; that's fine — tree walk is authoritative.
  }

  // 3) Final ranking + top-K
  allChunks.sort((a, b) => (b._score || 0) - (a._score || 0));
  const finalChunks = allChunks.slice(0, topK).map((c) => ({
    project_document_id: c.project_document_id,
    project_document_title: c.project_document_title,
    project_document_doc_type: c.project_document_doc_type,
    node_id: c.node_id,
    section_path: c.section_path,
    heading: c.heading,
    page_number: c.page_number,
    content: c.content,
    summary: c.summary,
    score: Number((c._score || 0).toFixed(3)),
  }));

  return {
    chunks: finalChunks,
    traversal,
    documents: candidateDocs.map((d) => ({
      project_document_id: d.project_document_id,
      title: d.title || d.original_filename,
      doc_type: d.doc_type,
      version: d.version,
      status: d.status,
    })),
  };
}

async function search(params) {
  return selectChunks(params);
}

module.exports = {
  selectChunks,
  search,
  // exposed for tests / ai_engine plugins
  tokenize,
  scoreNode,
};
