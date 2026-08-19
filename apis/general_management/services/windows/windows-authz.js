"use strict";
const { db } = require("../../database/mysql/factories/windows-w1-factory");
function principal(request) {
  const userId = request.headers["x-user-id"];
  const organizationId = Number(request.headers["x-organization-id"] || request.headers["organization-id"]);
  if (!userId || !Number.isInteger(organizationId)) throw Object.assign(new Error("x-user-id and x-organization-id are required"), { code: "UNAUTHENTICATED", statusCode: 401 });
  return { userId: String(userId), organizationId };
}
async function requirePermission(request, permission) {
  const actor = principal(request);
  const [rows] = await db.sequelize.query(`SELECT 1 FROM user_role ur JOIN role_permission rp ON rp.role_id=ur.role_id AND rp.organization_id=ur.organization_id JOIN permission p ON p.permission_id=rp.permission_id AND p.organization_id=rp.organization_id WHERE ur.user_id=:userId AND ur.organization_id=:organizationId AND p.name=:permission AND p.is_active=1 AND p.deleted_date IS NULL LIMIT 1`, { replacements: { ...actor, userId: Number(actor.userId), permission } });
  if (!rows.length) throw Object.assign(new Error("Permission denied"), { code: "FORBIDDEN", statusCode: 403 });
  return actor;
}
function sameTenant(actor, record) { if (!record || Number(record.organization_id) !== actor.organizationId) throw Object.assign(new Error("Cross-tenant resource access denied"), { code: "NOT_FOUND", statusCode: 404 }); return record; }
module.exports = { principal, requirePermission, sameTenant };
