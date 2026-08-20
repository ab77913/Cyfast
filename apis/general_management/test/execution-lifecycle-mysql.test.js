"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Sequelize } = require("sequelize");
const {
  ExecutionLifecycleRepository,
} = require("../database/mysql/repositories/execution-lifecycle-repository");

const connectionUrl = process.env.CYFAST_TEST_MYSQL_URL;

test("execution lifecycle repository persists runs, events, attempts, artifacts, and defects", {
  skip: !connectionUrl,
}, async () => {
  const sequelize = new Sequelize(connectionUrl, {
    logging: false,
    pool: { max: 2, min: 0, idle: 1000 },
  });
  const repository = new ExecutionLifecycleRepository({ sequelize });
  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await sequelize.authenticate();
    const created = await repository.createExecution({
      id,
      organizationId: "org-mysql",
      projectId: "project-mysql",
      platform: "WINDOWS",
      status: "CREATED",
      statusVersion: 1,
      idempotencyKey: `idem-${id}`,
      correlationId: `corr-${id}`,
      requirementId: "requirement-1",
      scenarioId: "scenario-1",
      testCaseId: "test-case-1",
      testScriptId: "test-script-1",
      packageSnapshot: { files: [{ path: "suite.robot" }] },
      packageSha256: "a".repeat(64),
      targetSnapshot: { id: "target-1", capabilities: ["HTTP_AGENT", "WINDOWS"] },
      targetId: "target-1",
      requestedBy: "user-1",
      repairAttempts: 0,
      attemptNumber: 0,
      cancelRequested: false,
      createdAt: now,
      updatedAt: now,
    });
    assert.equal(created.id, id);
    assert.deepEqual(created.packageSnapshot.files, [{ path: "suite.robot" }]);

    const duplicate = await repository.createExecution({
      ...created,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
    assert.equal(duplicate.id, id, "idempotency conflict must return the existing execution");

    const queued = await repository.updateExecution(id, {
      status: "QUEUED",
      statusVersion: 2,
      updatedAt: new Date(),
    }, 1);
    assert.equal(queued.status, "QUEUED");
    assert.equal(queued.statusVersion, 2);

    await assert.rejects(
      repository.updateExecution(id, {
        status: "RUNNING",
        statusVersion: 3,
        updatedAt: new Date(),
      }, 1),
      (error) => error.code === "EXECUTION_VERSION_CONFLICT",
    );

    const firstEvent = await repository.appendEvent({
      id: crypto.randomUUID(),
      executionId: id,
      organizationId: "org-mysql",
      projectId: "project-mysql",
      type: "EXECUTION_QUEUED",
      status: "QUEUED",
      details: { realExecution: true },
      createdAt: new Date(),
    });
    const secondEvent = await repository.appendEvent({
      id: crypto.randomUUID(),
      executionId: id,
      organizationId: "org-mysql",
      projectId: "project-mysql",
      type: "RUNTIME_CHECK_STARTED",
      status: "CHECKING_RUNTIME",
      details: {},
      createdAt: new Date(),
    });
    assert.equal(firstEvent.sequence, 1);
    assert.equal(secondEvent.sequence, 2);
    const events = await repository.listEvents({
      organizationId: "org-mysql",
      projectId: "project-mysql",
      executionId: id,
      afterSequence: 0,
    });
    assert.deepEqual(events.map((event) => event.sequence), [1, 2]);

    await repository.upsertAttempt({
      id: crypto.randomUUID(),
      executionId: id,
      organizationId: "org-mysql",
      projectId: "project-mysql",
      attemptNumber: 1,
      packageSha256: "a".repeat(64),
      status: "RUNNING",
      runtimeProof: { ready: true },
      resultProof: null,
      rawResult: null,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await repository.upsertAttempt({
      id: crypto.randomUUID(),
      executionId: id,
      organizationId: "org-mysql",
      projectId: "project-mysql",
      attemptNumber: 1,
      packageSha256: "a".repeat(64),
      status: "PASSED",
      runtimeProof: { ready: true },
      resultProof: { meaningfulAssertions: 1 },
      rawResult: { robotExitCode: 0 },
      startedAt: new Date(),
      finishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const artifactId = crypto.randomUUID();
    const artifact = await repository.createArtifact({
      id: artifactId,
      executionId: id,
      attemptNumber: 1,
      organizationId: "org-mysql",
      projectId: "project-mysql",
      type: "ROBOT_OUTPUT_XML",
      fileName: "output.xml",
      contentType: "application/xml",
      size: 10,
      sha256: "b".repeat(64),
      storageReference: "storage://execution/output.xml",
      createdAt: new Date(),
    });
    assert.equal(artifact.id, artifactId);
    const artifacts = await repository.listArtifacts({
      organizationId: "org-mysql",
      projectId: "project-mysql",
      executionId: id,
    });
    assert.equal(artifacts.length, 1);

    await repository.linkDefect({
      id: crypto.randomUUID(),
      executionId: id,
      attemptNumber: 1,
      organizationId: "org-mysql",
      projectId: "project-mysql",
      defectId: "defect-1",
      failureClassification: "PRODUCT_DEFECT",
      createdAt: new Date(),
    });

    const page = await repository.listExecutions({
      organizationId: "org-mysql",
      projectId: "project-mysql",
      page: 1,
      pageSize: 25,
    });
    assert.equal(page.items.length, 1);
    assert.equal(page.pagination.total, 1);
  } finally {
    await sequelize.close();
  }
});
