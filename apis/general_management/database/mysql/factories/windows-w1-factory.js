"use strict";
const db = require("../models");

function model(name) {
  if (!db[name]) throw new Error(`Windows W1 model unavailable: ${name}`);
  return db[name];
}
async function getById(name, key, value, organizationId) {
  return model(name).findOne({ where: { [key]: value, organization_id: organizationId, deleted_date: null } });
}
async function list(name, organizationId, where = {}) {
  return model(name).findAll({ where: { ...where, organization_id: organizationId, deleted_date: null }, order: [["created_date", "DESC"]] });
}
module.exports = { db, model, getById, list };
