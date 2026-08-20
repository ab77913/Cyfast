"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const targetPath = path.join(repositoryRoot, "apis", "general_management", "index.js");
const REQUIRE_MARKER = "execution-lifecycle-plugin";
const REGISTER_MARKER = "CYFAST_EXECUTION_LIFECYCLE_REGISTERED";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function detectServerVariable(source) {
  const patterns = [
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(["']fastify["']\)\s*\(/,
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*Fastify\s*\(/,
    /([A-Za-z_$][\w$]*)\.listen\s*\(/,
    /([A-Za-z_$][\w$]*)\.register\s*\(/,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function insertCommonJsRequire(source) {
  if (source.includes(REQUIRE_MARKER)) return source;
  const requireLine = 'const executionLifecyclePlugin = require("./plugins/execution-lifecycle-plugin");\n';
  const lines = source.split(/(?<=\n)/);
  let insertionIndex = 0;
  if (lines[0]?.match(/^\s*["']use strict["'];/)) insertionIndex = 1;
  for (let index = insertionIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(?:const|let|var)\s+.+?=\s*require\(/.test(line) ||
        /^\s*require\(/.test(line) ||
        /^\s*$/.test(line)) {
      insertionIndex = index + 1;
      continue;
    }
    break;
  }
  lines.splice(insertionIndex, 0, requireLine);
  return lines.join("");
}

function insertEsmImport(source) {
  if (source.includes(REQUIRE_MARKER)) return source;
  const importLine = 'import executionLifecyclePlugin from "./plugins/execution-lifecycle-plugin.js";\n';
  const lines = source.split(/(?<=\n)/);
  let insertionIndex = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*import\s/.test(lines[index]) || /^\s*$/.test(lines[index])) {
      insertionIndex = index + 1;
      continue;
    }
    break;
  }
  lines.splice(insertionIndex, 0, importLine);
  return lines.join("");
}

function insertRegistration(source, serverVariable) {
  if (source.includes(REGISTER_MARKER)) return source;
  const lines = source.split(/(?<=\n)/);
  let insertionIndex = -1;
  let indentation = "";

  for (let index = 0; index < lines.length; index += 1) {
    const listenPattern = new RegExp(`^(\\s*)(?:await\\s+)?${serverVariable}\\.listen\\s*\\(`);
    const match = lines[index].match(listenPattern);
    if (match) {
      insertionIndex = index;
      indentation = match[1];
      break;
    }
  }

  if (insertionIndex < 0) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const registerPattern = new RegExp(`^(\\s*)${serverVariable}\\.register\\s*\\(`);
      const match = lines[index].match(registerPattern);
      if (match) {
        insertionIndex = index + 1;
        indentation = match[1];
        break;
      }
    }
  }

  if (insertionIndex < 0) {
    throw new Error(`Unable to locate ${serverVariable}.listen() or ${serverVariable}.register().`);
  }

  lines.splice(
    insertionIndex,
    0,
    `${indentation}// ${REGISTER_MARKER}\n`,
    `${indentation}${serverVariable}.register(executionLifecyclePlugin);\n`,
  );
  return lines.join("");
}

function main() {
  if (!fs.existsSync(targetPath)) {
    fail(`General Management entry point not found: ${targetPath}`);
    return;
  }
  const original = fs.readFileSync(targetPath, "utf8");
  const serverVariable = detectServerVariable(original);
  if (!serverVariable) {
    fail("Unable to identify the Fastify server variable in General Management index.js.");
    return;
  }

  let updated = original;
  const isEsm = /^\s*import\s/m.test(original) && !/require\(["']fastify["']\)/.test(original);
  updated = isEsm ? insertEsmImport(updated) : insertCommonJsRequire(updated);
  try {
    updated = insertRegistration(updated, serverVariable);
  } catch (error) {
    fail(error.message);
    return;
  }

  if (updated === original) {
    process.stdout.write("Execution lifecycle plugin is already integrated.\n");
    return;
  }
  fs.writeFileSync(targetPath, updated, "utf8");
  process.stdout.write(`Integrated execution lifecycle plugin with ${serverVariable}.register().\n`);
}

main();
