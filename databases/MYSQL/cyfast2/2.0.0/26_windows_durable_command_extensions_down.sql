ALTER TABLE execution_command_result
  DROP INDEX uq_ecr_command_org;

ALTER TABLE execution_command
  DROP INDEX idx_ec_agent_status,
  DROP INDEX idx_ec_execution,
  DROP COLUMN result_received_at,
  DROP COLUMN result,
  DROP COLUMN attempt_count,
  DROP COLUMN execution_id,
  DROP COLUMN project_id;
