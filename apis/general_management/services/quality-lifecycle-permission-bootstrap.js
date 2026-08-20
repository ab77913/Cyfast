"use strict";

const db = require("../database/mysql/models");

const QUALITY_LIFECYCLE_PERMISSIONS = Object.freeze([
  "quality_lifecycle.read",
  "quality_lifecycle.manage",
  "quality_lifecycle.approve",
]);

async function ensureQualityLifecyclePermissions(organizationId, roleName = "Super Admin") {
  const normalized = Number(organizationId);
  if (!Number.isInteger(normalized) || normalized <= 0) throw new TypeError("organizationId must be a positive integer");
  return db.sequelize.transaction(async (transaction) => {
    for (const name of QUALITY_LIFECYCLE_PERMISSIONS) {
      await db.sequelize.query(
        `INSERT INTO permission
           (organization_id, name, description, permission_type, permission_value, is_active, created_by, created_date)
         SELECT :organizationId, :name, 'CyFAST quality lifecycle permission', 'feature', :name, 1,
                'quality-lifecycle-permission-bootstrap', NOW(3)
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
        replacements: { organizationId: normalized, permissionCodes: QUALITY_LIFECYCLE_PERMISSIONS },
        type: db.Sequelize.QueryTypes.SELECT,
        transaction,
      },
    );
    const roles = await db.sequelize.query(
      `SELECT role_id FROM role
       WHERE organization_id = :organizationId AND name = :roleName
         AND is_active = 1 AND deleted_date IS NULL LIMIT 1`,
      {
        replacements: { organizationId: normalized, roleName },
        type: db.Sequelize.QueryTypes.SELECT,
        transaction,
      },
    );
    let assigned = 0;
    if (roles[0]) {
      for (const permission of permissions) {
        const [result] = await db.sequelize.query(
          `INSERT INTO role_permission
             (organization_id, role_id, permission_id, created_by, created_date)
           SELECT :organizationId, :roleId, :permissionId,
                  'quality-lifecycle-permission-bootstrap', NOW(3)
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
    return { organizationId: normalized, permissions: permissions.map((item) => item.name), assigned };
  });
}

module.exports = { QUALITY_LIFECYCLE_PERMISSIONS, ensureQualityLifecyclePermissions };
