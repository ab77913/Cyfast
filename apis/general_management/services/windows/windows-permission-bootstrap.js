"use strict";

const store = () => require("../../database/mysql/factories/windows-w1-factory");

const WINDOWS_PERMISSION_CODES = Object.freeze([
  "windows_agent.enroll",
  "windows_agent.read",
  "windows_agent.manage",
  "windows_session.create",
  "windows_session.control",
  "windows_session.inspect",
  "windows_evidence.read",
  "windows_application_profile.manage",
]);

function createPermissionBootstrap(storeProvider = store) {
  return async function ensurePermissionsForOrganization(organizationId, { assignToRoleName = "Super Admin" } = {}) {
    const normalizedOrganizationId = Number(organizationId);
    if (!Number.isInteger(normalizedOrganizationId) || normalizedOrganizationId <= 0) {
      throw new TypeError("organizationId must be a positive integer");
    }

    const { db } = storeProvider();
    return db.sequelize.transaction(async (transaction) => {
    for (const name of WINDOWS_PERMISSION_CODES) {
      await db.sequelize.query(
        `INSERT INTO permission
          (organization_id, name, description, permission_type, permission_value, created_by, created_date)
         SELECT :organizationId, :name, 'Windows Connect W1 permission', 'feature', :name, 'windows-permission-bootstrap', NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM permission
           WHERE organization_id = :organizationId AND name = :name AND deleted_date IS NULL
         )`,
        { replacements: { organizationId: normalizedOrganizationId, name }, transaction }
      );
    }

    const permissions = await db.sequelize.query(
      `SELECT permission_id, name FROM permission
       WHERE organization_id = :organizationId
         AND name IN (:permissionCodes)
         AND deleted_date IS NULL`,
      {
        replacements: { organizationId: normalizedOrganizationId, permissionCodes: WINDOWS_PERMISSION_CODES },
        type: db.Sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    let assigned = 0;
    if (assignToRoleName) {
      const roles = await db.sequelize.query(
        `SELECT role_id FROM role
         WHERE organization_id = :organizationId AND name = :roleName
           AND is_active = 1 AND deleted_date IS NULL
         LIMIT 1`,
        {
          replacements: { organizationId: normalizedOrganizationId, roleName: assignToRoleName },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction,
        }
      );
      const role = roles[0];
      if (role) {
        for (const permission of permissions) {
          const [result] = await db.sequelize.query(
            `INSERT INTO role_permission (organization_id, role_id, permission_id, created_by, created_date)
             SELECT :organizationId, :roleId, :permissionId, 'windows-permission-bootstrap', NOW()
             WHERE NOT EXISTS (
               SELECT 1 FROM role_permission
               WHERE organization_id = :organizationId AND role_id = :roleId
                 AND permission_id = :permissionId AND deleted_date IS NULL
             )`,
            {
              replacements: {
                organizationId: normalizedOrganizationId,
                roleId: role.role_id,
                permissionId: permission.permission_id,
              },
              transaction,
            }
          );
          assigned += Number(result.affectedRows || 0);
        }
      }
    }

      return { organizationId: normalizedOrganizationId, permissions: permissions.map(({ name }) => name), assigned };
    });
  };
}

const ensurePermissionsForOrganization = createPermissionBootstrap();
module.exports = { WINDOWS_PERMISSION_CODES, createPermissionBootstrap, ensurePermissionsForOrganization };
