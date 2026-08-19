"use strict";

/**
 * Stored in `job`.`job_type` for multi-purpose generation queues.
 */
const JOB_TYPES = Object.freeze({
  REQUIREMENT_GENERATION: "REQUIREMENT_GENERATION",
  TEST_SCENARIO_GENERATION: "TEST_SCENARIO_GENERATION",
  TEST_CASE_GENERATION: "TEST_CASE_GENERATION",
});

module.exports = { JOB_TYPES };
