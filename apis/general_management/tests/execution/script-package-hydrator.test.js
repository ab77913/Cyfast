"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HARD_PACKAGE_LIMIT_BYTES,
  hydrateScriptPackage,
  parseLocalImports,
  validateTextFile,
} = require("../../services/execution/script-package-hydrator");

function repository(script) {
  return {
    calls: [],
    async loadScript(scope) {
      this.calls.push(scope);
      return script;
    },
  };
}

const root = `*** Settings ***
Resource    resources/login.resource
Library     libraries/helpers.py

*** Test Cases ***
Valid Login
    Open Application    %{APP_PATH}
    Input Text    username    demo
    Click Button    login
    Element Should Be Visible    dashboard
`;

const loginResource = `*** Keywords ***
Login With User
    [Arguments]    \${username}
    Input Text    username    \${username}
`;

const helperLibrary = `def normalize(value):
    return str(value).strip()
`;

test("hydrates selected script and recursively validates local imports", async () => {
  const repo = repository({
    filename: "suites/login.robot",
    content: root,
    version: "3",
    resources: [
      { path: "suites/resources/login.resource", content: loginResource },
      { path: "suites/libraries/helpers.py", content: helperLibrary },
    ],
  });
  const result = await hydrateScriptPackage({ organizationId: 5, projectId: 9, testScriptId: 11, repository: repo });
  assert.deepEqual(repo.calls[0], { organizationId: 5, projectId: 9, testScriptId: 11 });
  assert.equal(result.suite_path, "suites/login.robot");
  assert.equal(result.files.length, 3);
  assert.equal(result.manifest.meaningful_actions >= 3, true);
  assert.equal(result.manifest.meaningful_assertions >= 1, true);
  assert.equal(result.package_sha256.length, 64);
  assert.ok(result.files.every((file) => file.sha256.length === 64 && file.content_base64));
});

test("rejects missing imports instead of dispatching an incomplete package", async () => {
  const repo = repository({ filename: "login.robot", content: root, resources: [] });
  await assert.rejects(
    () => hydrateScriptPackage({ organizationId: 1, projectId: 1, testScriptId: 1, repository: repo }),
    /Missing Resource referenced by login\.robot/,
  );
});

test("rejects absolute and traversing resource paths", async () => {
  const repo = repository({
    filename: "login.robot",
    content: root.replace("resources/login.resource", "../login.resource").replace("libraries/helpers.py", "BuiltIn"),
    resources: [{ path: "../login.resource", content: loginResource }],
  });
  await assert.rejects(
    () => hydrateScriptPackage({ organizationId: 1, projectId: 1, testScriptId: 1, repository: repo }),
    /Unsafe package path/,
  );
});

test("rejects scripts with plaintext secrets, placeholders, or arbitrary shell", () => {
  assert.throws(() => validateTextFile("suite.robot", "${PASSWORD}    plain-text"), /plaintext credential/i);
  assert.throws(() => validateTextFile("suite.robot", "Click Element    <locator>"), /placeholder automation/i);
  assert.throws(() => validateTextFile("suite.robot", "Run Process    powershell    -Command    whoami"), /shell execution/i);
});

test("rejects packages exceeding the hard size limit", async () => {
  const huge = `${root}\n# ${"x".repeat(HARD_PACKAGE_LIMIT_BYTES)}`;
  const repo = repository({
    filename: "login.robot",
    content: huge.replace("resources/login.resource", "BuiltIn").replace("Library     libraries/helpers.py", "Library     BuiltIn"),
    resources: [],
  });
  await assert.rejects(
    () => hydrateScriptPackage({ organizationId: 1, projectId: 1, testScriptId: 1, repository: repo }),
    /maximum is/,
  );
});

test("Robot settings parser handles Resource Variables and local Python Library", () => {
  assert.deepEqual(
    parseLocalImports(`*** Settings ***\nResource    a.resource\nVariables    data.py\nLibrary    local.py\nLibrary    BuiltIn`),
    [
      { type: "Resource", value: "a.resource" },
      { type: "Variables", value: "data.py" },
      { type: "Library", value: "local.py" },
      { type: "Library", value: "BuiltIn" },
    ],
  );
});
