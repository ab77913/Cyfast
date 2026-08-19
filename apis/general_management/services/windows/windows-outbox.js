"use strict";
const { model } = require("../../database/mysql/factories/windows-w1-factory");
async function writeOutbox({ organization_id, event_type, aggregate_id, payload, correlation_id, transaction }) {
  return model("WindowsOutboxEvent").create({ organization_id, event_type, aggregate_id, payload, correlation_id }, { transaction });
}
module.exports = { writeOutbox };
