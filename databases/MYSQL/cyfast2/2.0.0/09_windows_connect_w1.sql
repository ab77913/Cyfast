-- Windows Connect W1 (MySQL).
-- Permissions are registered per organization by
-- apis/general_management/services/windows/windows-permission-bootstrap.js.
CREATE TABLE IF NOT EXISTS agent_enrollment_token (
  agent_enrollment_token_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL, project_id INT NULL, token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL, allowed_platform VARCHAR(32) NOT NULL DEFAULT 'windows',
  consumed_at DATETIME NULL, consumed_by_agent_id VARCHAR(64) NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  INDEX idx_aet_org_expiry (organization_id, expires_at),
  INDEX idx_aet_expires_at (expires_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS agent_identity (
  agent_id VARCHAR(64) PRIMARY KEY, organization_id INT NOT NULL, public_key TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ENROLLED', agent_version VARCHAR(64) NULL, os VARCHAR(64) NULL, architecture VARCHAR(32) NULL, revoked_at DATETIME NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  INDEX idx_ai_org (organization_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS agent_certificate (
  agent_certificate_id BIGINT AUTO_INCREMENT PRIMARY KEY, agent_id VARCHAR(64) NOT NULL, organization_id INT NOT NULL,
  certificate_fingerprint CHAR(64) NULL, expires_at DATETIME NULL, metadata JSON NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  CONSTRAINT fk_ac_agent FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS agent_installation (
  agent_installation_id BIGINT AUTO_INCREMENT PRIMARY KEY, agent_id VARCHAR(64) NOT NULL, organization_id INT NOT NULL, hostname VARCHAR(255) NULL, installed_at DATETIME NULL, metadata JSON NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  CONSTRAINT fk_ain_agent FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS agent_capability (
  agent_capability_id BIGINT AUTO_INCREMENT PRIMARY KEY, agent_id VARCHAR(64) NOT NULL, organization_id INT NOT NULL, capability VARCHAR(128) NOT NULL, details JSON NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  UNIQUE KEY uq_acap_agent_capability (agent_id, capability), CONSTRAINT fk_acap_agent FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS agent_health (
  agent_health_id BIGINT AUTO_INCREMENT PRIMARY KEY, agent_id VARCHAR(64) NOT NULL, organization_id INT NOT NULL, status VARCHAR(32) NOT NULL, observed_at DATETIME NOT NULL, details JSON NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  INDEX idx_ah_agent_observed (agent_id, observed_at), CONSTRAINT fk_ah_agent FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS windows_node (
  windows_node_id BIGINT AUTO_INCREMENT PRIMARY KEY, agent_id VARCHAR(64) NOT NULL UNIQUE, organization_id INT NOT NULL, name VARCHAR(255) NULL,
  status ENUM('OFFLINE','ENROLLING','ONLINE','NO_INTERACTIVE_SESSION','SESSION_LOCKED','READY','BUSY','DEGRADED','UPDATING','REVOKED') NOT NULL DEFAULT 'ENROLLING',
  last_seen_at DATETIME NULL, metadata JSON NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  INDEX idx_wn_org_status (organization_id, status), CONSTRAINT fk_wn_agent FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id)
) ENGINE=InnoDB;
-- Profile options such as allow_terminate and expected_process_name are stored
-- in configuration JSON; no additional profile columns are required for W1.
CREATE TABLE IF NOT EXISTS windows_application_profile (
  windows_application_profile_id BIGINT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, project_id INT NULL, name VARCHAR(255) NOT NULL, executable_path TEXT NULL, allowlist JSON NOT NULL, configuration JSON NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS interactive_session (
  interactive_session_id VARCHAR(64) PRIMARY KEY, windows_node_id BIGINT NOT NULL, organization_id INT NOT NULL, application_profile_id BIGINT NULL, status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED', requested_by VARCHAR(100) NULL, started_at DATETIME NULL, ended_at DATETIME NULL, metadata JSON NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  CONSTRAINT fk_is_node FOREIGN KEY (windows_node_id) REFERENCES windows_node(windows_node_id), CONSTRAINT fk_is_profile FOREIGN KEY (application_profile_id) REFERENCES windows_application_profile(windows_application_profile_id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ui_snapshot (
  ui_snapshot_id BIGINT AUTO_INCREMENT PRIMARY KEY, interactive_session_id VARCHAR(64) NOT NULL, organization_id INT NOT NULL, tree JSON NOT NULL, created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  CONSTRAINT fk_us_session FOREIGN KEY (interactive_session_id) REFERENCES interactive_session(interactive_session_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ui_element (
  ui_element_id BIGINT AUTO_INCREMENT PRIMARY KEY, ui_snapshot_id BIGINT NOT NULL, organization_id INT NOT NULL, element_path VARCHAR(1024) NOT NULL, properties JSON NOT NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  CONSTRAINT fk_ue_snapshot FOREIGN KEY (ui_snapshot_id) REFERENCES ui_snapshot(ui_snapshot_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS execution_command (
  execution_command_id VARCHAR(64) PRIMARY KEY, interactive_session_id VARCHAR(64) NULL, agent_id VARCHAR(64) NOT NULL, organization_id INT NOT NULL, command_type VARCHAR(128) NOT NULL, payload JSON NOT NULL, payload_hash CHAR(64) NOT NULL, idempotency_key VARCHAR(128) NOT NULL, expires_at DATETIME NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED', correlation_id VARCHAR(64) NOT NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  UNIQUE KEY uq_ec_org_idempotency (organization_id, idempotency_key),
  INDEX idx_ec_expires_at (expires_at),
  INDEX idx_ec_correlation_id (correlation_id),
  CONSTRAINT fk_ec_agent FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id), CONSTRAINT fk_ec_session FOREIGN KEY (interactive_session_id) REFERENCES interactive_session(interactive_session_id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS execution_command_result (
  execution_command_result_id BIGINT AUTO_INCREMENT PRIMARY KEY, execution_command_id VARCHAR(64) NOT NULL, organization_id INT NOT NULL, status VARCHAR(32) NOT NULL, result JSON NULL, received_at DATETIME NOT NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  CONSTRAINT fk_ecr_command FOREIGN KEY (execution_command_id) REFERENCES execution_command(execution_command_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS execution_evidence (
  execution_evidence_id VARCHAR(64) PRIMARY KEY, execution_command_id VARCHAR(64) NULL, interactive_session_id VARCHAR(64) NULL, organization_id INT NOT NULL, storage_file_id VARCHAR(64) NOT NULL, content_hash CHAR(64) NOT NULL, content_type VARCHAR(255) NULL, retention_classification VARCHAR(64) NOT NULL DEFAULT 'STANDARD', filename VARCHAR(255) NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  INDEX idx_ee_content_hash (content_hash),
  CONSTRAINT fk_ee_command FOREIGN KEY (execution_command_id) REFERENCES execution_command(execution_command_id) ON DELETE SET NULL, CONSTRAINT fk_ee_session FOREIGN KEY (interactive_session_id) REFERENCES interactive_session(interactive_session_id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS windows_audit_event (
  windows_audit_event_id BIGINT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, agent_id VARCHAR(64) NULL, event_type VARCHAR(128) NOT NULL, actor_id VARCHAR(100) NULL, correlation_id VARCHAR(64) NULL, details JSON NULL,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  INDEX idx_wae_correlation_id (correlation_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS windows_outbox_event (
  windows_outbox_event_id BIGINT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, event_type VARCHAR(128) NOT NULL, aggregate_id VARCHAR(64) NULL, payload JSON NOT NULL, correlation_id VARCHAR(64) NULL, published_at DATETIME NULL, attempts INT NOT NULL DEFAULT 0,
  created_by VARCHAR(100) NULL, created_date DATETIME NULL, modified_by VARCHAR(100) NULL, modified_date DATETIME NULL, deleted_by VARCHAR(100) NULL, deleted_date DATETIME NULL,
  INDEX idx_woe_pending (published_at, created_date),
  INDEX idx_woe_correlation_id (correlation_id)
) ENGINE=InnoDB;
