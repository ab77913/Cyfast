"use strict";

const db = require("../models");
const { UserNotification } = db;

async function create(row) {
  return UserNotification.create({
    ...row,
    created_date: row.created_date || new Date(),
  });
}

async function listUnreadForUser(userId, { limit = 30 } = {}) {
  const lim = Math.min(Number(limit) || 30, 100);
  return UserNotification.findAll({
    where: { user_id: Number(userId), read_at: null, deleted_date: null },
    order: [["created_date", "DESC"]],
    limit: lim,
  });
}

async function countUnread(userId) {
  return UserNotification.count({
    where: { user_id: Number(userId), read_at: null, deleted_date: null },
  });
}

async function listRecent(userId, { limit = 50 } = {}) {
  const lim = Math.min(Number(limit) || 50, 200);
  return UserNotification.findAll({
    where: { user_id: Number(userId), deleted_date: null },
    order: [["created_date", "DESC"]],
    limit: lim,
  });
}

async function markAllRead(userId, { readBy, modifiedBy } = {}) {
  const now = new Date();
  const rb = readBy ? String(readBy).slice(0, 100) : null;
  const mb = modifiedBy ? String(modifiedBy).slice(0, 100) : rb;
  const [rows] = await UserNotification.update(
    {
      read_at: now,
      read_by: rb,
      modified_date: now,
      modified_by: mb,
    },
    {
      where: {
        user_id: Number(userId),
        read_at: null,
        deleted_date: null,
      },
    },
  );
  return rows;
}

async function markRead(notificationId, userId, { readBy, modifiedBy } = {}) {
  const now = new Date();
  const rb = readBy ? String(readBy).slice(0, 100) : null;
  const mb = modifiedBy ? String(modifiedBy).slice(0, 100) : rb;
  const [rows] = await UserNotification.update(
    {
      read_at: now,
      read_by: rb,
      modified_date: now,
      modified_by: mb,
    },
    {
      where: {
        user_notification_id: Number(notificationId),
        user_id: Number(userId),
        deleted_date: null,
      },
    },
  );
  return rows;
}

module.exports = {
  create,
  listUnreadForUser,
  listRecent,
  countUnread,
  markAllRead,
  markRead,
};
