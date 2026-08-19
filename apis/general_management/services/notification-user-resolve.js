"use strict";

const { QueryTypes } = require("sequelize");
const db = require("../database/mysql/models");

/**
 * Resolve x-user-id style principal (numeric id, email, or username) to `user.user_id`.
 */
async function resolveUserIdFromPrincipal(principal) {
  if (principal === undefined || principal === null) return null;
  const raw = String(principal).trim();
  if (!raw) return null;
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && asNum > 0) {
    const rows = await db.sequelize.query(
      "SELECT user_id FROM `user` WHERE user_id = :id AND deleted_date IS NULL LIMIT 1",
      { replacements: { id: asNum }, type: QueryTypes.SELECT },
    );
    return rows[0]?.user_id ?? null;
  }
  const rows = await db.sequelize.query(
    "SELECT user_id FROM `user` WHERE (email = :s OR username = :s) AND deleted_date IS NULL LIMIT 1",
    { replacements: { s: raw }, type: QueryTypes.SELECT },
  );
  return rows[0]?.user_id ?? null;
}

module.exports = { resolveUserIdFromPrincipal };
