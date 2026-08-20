-- Explicit rollback for CyFAST Phase A execution lifecycle tables.
-- Run only after evidence retention and change approval have been completed.

DROP TABLE IF EXISTS execution_defect_links;
DROP TABLE IF EXISTS execution_artifacts;
DROP TABLE IF EXISTS execution_events;
DROP TABLE IF EXISTS execution_attempts;
DROP TABLE IF EXISTS execution_runs;
