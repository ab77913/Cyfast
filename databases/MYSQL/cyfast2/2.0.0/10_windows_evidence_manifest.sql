-- W1 evidence manifest and command lifecycle extensions (MySQL)
CREATE TABLE IF NOT EXISTS windows_command_evidence_manifest (
  windows_command_evidence_manifest_id VARCHAR(64) PRIMARY KEY,
  organization_id INT NOT NULL,
  project_id INT NULL,
  execution_command_id VARCHAR(64) NOT NULL,
  interactive_session_id VARCHAR(64) NULL,
  command_type VARCHAR(128) NOT NULL,
  required_evidence_types JSON NOT NULL,
  received_evidence_types JSON NOT NULL,
  content_hashes JSON NOT NULL,
  upload_attempts INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'EVIDENCE_PENDING',
  failure_reason VARCHAR(512) NULL,
  created_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  created_by VARCHAR(100) NULL,
  created_date DATETIME NULL,
  modified_by VARCHAR(100) NULL,
  modified_date DATETIME NULL,
  deleted_by VARCHAR(100) NULL,
  deleted_date DATETIME NULL,
  UNIQUE KEY uq_wcem_command (execution_command_id),
  INDEX idx_wcem_status (status),
  CONSTRAINT fk_wcem_command FOREIGN KEY (execution_command_id) REFERENCES execution_command(execution_command_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Widen execution_command.status to support lifecycle states (VARCHAR already 32).
-- No destructive ALTERs required; statuses are application-enforced.
