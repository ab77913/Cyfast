"use strict";

/**
 * Persist a user-visible notification resolved from x-user-id style principals
 * (numeric id, email, or username). Best-effort: unresolved principals log and return.
 */

const userNotificationFactory = require("../database/mysql/factories/user-notification-factory");
const { resolveUserIdFromPrincipal } = require("./notification-user-resolve");

/**
 * @param {string | number | null | undefined} recipientPrincipal
 * @param {{
 *   category: string,
 *   title: string,
 *   body?: string,
 *   referenceType?: string | null,
 *   referenceId?: string | number | null,
 *   createdBy?: string | null,
 * }} opts
 */
async function notifyUserFromPrincipal(recipientPrincipal, opts) {
  if (
    recipientPrincipal === undefined ||
    recipientPrincipal === null ||
    !opts?.title
  ) {
    return;
  }
  const rp = String(recipientPrincipal).trim();
  if (!rp) return;

  const uid = await resolveUserIdFromPrincipal(rp);
  if (!uid) {
    console.warn(
      "user_notification: unresolved principal (user id / email / username expected):",
      rp,
    );
    return;
  }

  const auditBy =
    opts.createdBy != null ? String(opts.createdBy).slice(0, 100) : "system";

  try {
    const ref =
      opts.referenceId != null
        ? String(opts.referenceId).slice(0, 128)
        : null;

    await userNotificationFactory.create({
      user_id: uid,
      category: opts.category || "general",
      title: String(opts.title).slice(0, 255),
      body: opts.body != null ? String(opts.body) : "",
      reference_type: opts.referenceType || null,
      reference_id: ref,
      created_by: auditBy,
      modified_by: auditBy,
      modified_date: new Date(),
      created_date: new Date(),
    });
  } catch (e) {
    console.error("user_notification insert failed:", e.message);
  }
}

module.exports = { notifyUserFromPrincipal };
