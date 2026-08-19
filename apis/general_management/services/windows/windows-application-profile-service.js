"use strict";
const { model, list, getById } = require("../../database/mysql/factories/windows-w1-factory");
const { assertSafeExecutablePath, normalizeProfile } = require("./windows-profile-validation");

const profile = (id, org) => getById("WindowsApplicationProfile", "windows_application_profile_id", id, org);

async function create(data, actor) {
  const normalized = normalizeProfile(data);
  return model("WindowsApplicationProfile").create({ ...normalized, created_by: actor });
}

async function update(id, org, data, actor) {
  const value = await profile(id, org);
  if (!value) return null;
  const normalized = normalizeProfile({ ...value.toJSON(), ...data, organization_id: org });
  return value.update({ ...normalized, modified_by: actor });
}

async function remove(id, org, actor) {
  const value = await profile(id, org);
  return value ? value.update({ deleted_date: new Date(), deleted_by: actor }) : null;
}

module.exports = {
  list: (org) => list("WindowsApplicationProfile", org),
  profile,
  create,
  update,
  remove,
  assertSafeExecutablePath,
  normalizeProfile,
};
