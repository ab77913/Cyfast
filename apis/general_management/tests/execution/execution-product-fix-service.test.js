"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const productFix = require("../../services/execution/execution-product-fix-service");

test("safe Git branches are accepted and traversal-like refs are rejected", () => {
  assert.equal(productFix.safeBranch("fix/correct-save-state", "fix_branch"), "fix/correct-save-state");
  for (const value of ["../main", "bad branch", "feature..broken", "feature@{1}", "feature\\name", "/rooted", "trailing/"]) {
    assert.throws(() => productFix.safeBranch(value, "fix_branch"), /safe Git branch/);
  }
});

test("repository and pull request URLs cannot contain credentials or use insecure HTTP", () => {
  assert.equal(
    productFix.safeUrl("https://github.com/example/product.git", "repository_url"),
    "https://github.com/example/product.git",
  );
  assert.throws(
    () => productFix.safeUrl("http://github.com/example/product.git", "repository_url"),
    /HTTPS\/SSH/,
  );
  assert.throws(
    () => productFix.safeUrl("https://token@github.com/example/product.git", "repository_url"),
    /must not contain credentials/,
  );
});

test("product fix normalization requires different branches and a meaningful change summary", () => {
  assert.throws(() => productFix.normalizeProductFix({
    repository_url: "https://github.com/example/product.git",
    base_branch: "main",
    fix_branch: "main",
    change_summary: "Correct the save transaction and retain the original assertion.",
  }), /must differ/);
  const value = productFix.normalizeProductFix({
    repository_url: "https://github.com/example/product.git",
    base_branch: "main",
    fix_branch: "fix/save-transaction",
    pull_request_url: "https://github.com/example/product/pull/42",
    commit_sha: "a".repeat(40),
    change_summary: "Correct the save transaction and retain the original assertion.",
    risk_assessment: { regression: "medium" },
  });
  assert.equal(value.commit_sha, "a".repeat(40));
  assert.equal(value.risk_assessment.regression, "medium");
});
