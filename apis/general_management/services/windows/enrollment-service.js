"use strict";
const crypto = require("crypto");
const store = () => require("../../database/mysql/factories/windows-w1-factory");
const { getEnrollmentPepper } = require("./windows-security-config");
const pepper = () => getEnrollmentPepper();
const hash = (token) => crypto.createHash("sha256").update(`${token}.${pepper()}`).digest("hex");
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};
function assertPepper() { pepper(); }
async function createToken({ organization_id, project_id = null, expires_at, allowed_platform = "windows", created_by }) {
  assertPepper(); const token = crypto.randomBytes(32).toString("base64url");
  await store().model("AgentEnrollmentToken").create({ organization_id, project_id, token_hash: hash(token), expires_at, allowed_platform, created_by });
  return token;
}
async function consumeToken({ token, agent_id, public_key, agent_version, os, architecture }) {
  assertPepper();
  if (!token || !agent_id || !public_key) {
    throw Object.assign(new Error("Enrollment requires token, agent_id and public_key"), {
      code: "ENROLLMENT_INVALID",
      statusCode: 400,
    });
  }
  const tokenHash = hash(token);
  return store().db.sequelize.transaction(async (transaction) => {
    const found = await store().model("AgentEnrollmentToken").findOne({
      where: { token_hash: tokenHash, deleted_date: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!found) {
      throw Object.assign(new Error("Invalid or expired enrollment token"), {
        code: "ENROLLMENT_INVALID",
        statusCode: 400,
      });
    }
    if (found.consumed_at) {
      throw Object.assign(new Error("Enrollment token already consumed"), {
        code: "ENROLLMENT_REUSED",
        statusCode: 409,
      });
    }
    if (new Date(found.expires_at) <= new Date() || found.allowed_platform !== "windows") {
      throw Object.assign(new Error("Invalid or expired enrollment token"), {
        code: "ENROLLMENT_INVALID",
        statusCode: 400,
      });
    }
    const existing = await store().model("AgentIdentity").findOne({
      where: { agent_id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing) {
      throw Object.assign(new Error("Agent identity already enrolled"), {
        code: "ENROLLMENT_DUPLICATE",
        statusCode: 409,
      });
    }
    await found.update({ consumed_at: new Date(), consumed_by_agent_id: agent_id }, { transaction });
    await store().model("AgentIdentity").create(
      {
        agent_id,
        organization_id: found.organization_id,
        public_key,
        status: "ENROLLED",
        agent_version,
        os,
        architecture,
        created_by: agent_id,
      },
      { transaction }
    );
    await store().model("WindowsNode").create(
      {
        agent_id,
        organization_id: found.organization_id,
        name: agent_id,
        status: "ENROLLING",
        created_by: agent_id,
      },
      { transaction }
    );
    await store().model("WindowsOutboxEvent").create(
      {
        organization_id: found.organization_id,
        event_type: "windows.agent.enrolled.v1",
        aggregate_id: agent_id,
        payload: { agent_id, organization_id: found.organization_id },
        correlation_id: agent_id,
      },
      { transaction }
    );
    return { agent_id, organization_id: found.organization_id, project_id: found.project_id };
  });
}
module.exports = { createToken, consumeToken, hash, safeEqual };
