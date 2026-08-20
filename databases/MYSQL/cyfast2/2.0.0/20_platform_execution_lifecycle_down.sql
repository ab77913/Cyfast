-- Rollback for 20_platform_execution_lifecycle.sql.
-- Apply only after confirming that execution evidence has been retained elsewhere.

DROP TABLE IF EXISTS execution_repair_attempt;
DROP TABLE IF EXISTS execution_defect;
DROP TABLE IF EXISTS execution_recording;
DROP TABLE IF EXISTS execution_artifact;
DROP TABLE IF EXISTS execution_event;
DROP TABLE IF EXISTS execution_run;
DROP TABLE IF EXISTS execution_target;
