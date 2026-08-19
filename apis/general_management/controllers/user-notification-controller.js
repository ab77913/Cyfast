"use strict";

const userNotificationFactory = require("../database/mysql/factories/user-notification-factory");
const { resolveUserIdFromPrincipal } = require("../services/notification-user-resolve");

function principalHeader(req) {
  return req.headers["x-user-id"] || req.headers["x-user-sub"] || null;
}

async function listMine(req, res) {
  try {
    const viewerUserId = await resolveUserIdFromPrincipal(principalHeader(req));
    if (!viewerUserId) {
      return res.status(200).json({ unread_count: 0, notifications: [] });
    }

    const unreadOnly =
      req.query.scope === "unread" ||
      req.query.unread_only === "1" ||
      req.query.unread_only === "true";

    if (unreadOnly) {
      const [notifications, unread_count] = await Promise.all([
        userNotificationFactory.listUnreadForUser(viewerUserId, {
          limit: req.query.limit,
        }),
        userNotificationFactory.countUnread(viewerUserId),
      ]);
      return res.status(200).json({ unread_count, notifications });
    }

    const notifications = await userNotificationFactory.listRecent(viewerUserId, {
      limit: req.query.limit,
    });
    const unread_count = await userNotificationFactory.countUnread(viewerUserId);
    return res.status(200).json({ unread_count, notifications });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function readAll(req, res) {
  try {
    const viewerUserId = await resolveUserIdFromPrincipal(principalHeader(req));
    if (!viewerUserId) {
      return res.status(200).json({ updated: 0 });
    }
    const acct = principalHeader(req) || "system";
    const n = await userNotificationFactory.markAllRead(viewerUserId, {
      readBy: acct,
      modifiedBy: acct,
    });
    return res.status(200).json({ updated: n });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function readOne(req, res) {
  try {
    const viewerUserId = await resolveUserIdFromPrincipal(principalHeader(req));
    if (!viewerUserId) {
      return res.status(404).json({ message: "Not found" });
    }
    const id = Number(req.params.notificationId);
    const acct = principalHeader(req) || "system";
    const n = await userNotificationFactory.markRead(id, viewerUserId, {
      readBy: acct,
      modifiedBy: acct,
    });
    if (!n) return res.status(404).json({ message: "Not found" });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listMine,
  readAll,
  readOne,
};
