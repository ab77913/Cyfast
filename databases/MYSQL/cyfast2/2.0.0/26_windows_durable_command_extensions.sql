-- Durable first-party Windows command correlation and replay metadata.
-- Apply once after 09_windows_connect_w1.sql.
ALTER TABLE execution_command
  ADD COLUMN project_id INT NULL AFTER organization_id,
  ADD COLUMN execution_id VARCHAR(64) NULL AFTER project_id,
  ADD COLUMN attempt_count INT NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN result JSON NULL AFTER correlation_id,
  ADD COLUMN result_received_at DATETIME NULL AFTER result,
  ADD INDEX idx_ec_execution (organization_id, project_id, execution_id),
  ADD INDEX idx_ec_agent_status (agent_id, status, expires_at);

ALTER TABLE execution_command_result
  ADD UNIQUE KEY uq_ecr_command_org (execution_command_id, organization_id);
