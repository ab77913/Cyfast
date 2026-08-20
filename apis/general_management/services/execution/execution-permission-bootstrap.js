"use strict";

const EXECUTION_PERMISSION_CODES = Object.freeze([
  "execution_target.read",
  "execution_target.manage",
  "execution_run.create",
  "execution_run.read",
  "execution_run.cancel",
  "execution_evidence.read",
  "execution_defect.read",
  "execution_defect.manage",
  "execution_repair.propose",
  "execution_repair.approve",
]);

function createPermissionBootstrap(storeProvider) {
  if (typeof storeProvider !== "function") throw new TypeError("storeProvider is required");
  return async function ensureExecutionPermissions(organizationId, { assignToRoleName = "Super Admin" } = {}) {
    const normalized = Number(organizationId);
    if (!Number.isInteger(normalized) || normalized <= 0) throw new TypeError("organizationId must be a positive integer");
    const { db } = storeProvider();

    return db.sequelize.transaction(async (transaction) => {
      for (const name of EXECUTION_PERMISSION_CODES) {
        await db.sequelize.query(
          `INSERT INTO permission
             (organization_id, name, description, permission_type, permission_value, is_active, created_by, created_date)
           SELECT :organizationId, :name, 'CyFAST cross-platform execution permission', 'feature', :name, 1,
                  'execution-permission-bootstrap', NOW(3)
           WHERE NOT EXISTS (
             SELECT 1 FROM permission
             WHERE organization_id = :organizationId AND name = :name AND deleted_date IS NULL
           )`,
          { replacements: { organizationId: normalized, name }, transaction },
        );
      }

      const permissions = await db.sequelize.query(
        `SELECT permission_id, name FROM permission
         WHERE organization_id = :organizationId
           AND name IN (:permissionCodes)
           AND deleted_date IS NULL`,
        {
          replacements: { organizationId: normalized, permissionCodes: EXECUTION_PERMISSION_CODES },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction,
        },
      );

      let assigned = 0;
      if (assignToRoleName) {
        const roles = await db.sequelize.query(
          `SELECT role_id FROM role
           WHERE organization_id = :organizationId AND name = :roleName
             AND is_active = 1 AND deleted_date IS NULL
           LIMIT 1`,
          {
            replacements: { organizationId: normalized, roleName: assignToRoleName },
            type: db.Sequelize.QueryTypes.SELECT,
            transaction,
          },
        );
        if (roles[0]) {
          for (const permission of permissions) {
            const [result] = await db.sequelize.query(
              `INSERT INTO role_permission
                 (organization_id, role_id, permission_id, created_by, created_date)
               SELECT :organizationId, :roleId, :permissionId, 'execution-permission-bootstrap', NOW(3)
               WHERE NOT EXISTS (
                 SELECT 1 FROM role_permission
                 WHERE organization_id = :organizationId AND role_id = :roleId
                   AND permission_id = :permissionId AND deleted_date IS NULL
               )`,
              {
                replacements: {
                  organizationId: normalized,
                  roleId: roles[0].role_id,
                  permissionId: permission.permission_id,
                },
                transaction,
              },
            );
            assigned += Number(result?.affectedRows || 0);
          }
        }
      }
      return { organizationId: normalized, permissions: permissions.map((item) => item.name), assigned };
    });
  };
}

function defaultStoreProvider() {
  const db = require("../../database/mysql/models");
  return { db };
}

const ensureExecutionPermissions = createPermissionBootstrap(defaultStoreProvider);

module.exports = {
  EXECUTION_PERMISSION_CODES,
  createPermissionBootstrap,
  ensureExecutionPermissions,
};
