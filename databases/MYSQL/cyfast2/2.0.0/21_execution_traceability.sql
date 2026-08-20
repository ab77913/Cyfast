CREATE TABLE IF NOT EXISTS execution_trace_link (
  execution_trace_link_id VARCHAR(64) NOT NULL,
  organization_id INT NOT NULL,
  project_id INT NOT NULL,
  execution_run_id VARCHAR(64) NOT NULL,
  link_type VARCHAR(32) NOT NULL,
  resource_id VARCHAR(128) NOT NULL,
  resource_version VARCHAR(128) NOT NULL DEFAULT 'current',
  relationship VARCHAR(64) NOT NULL,
  source_system VARCHAR(64) NOT NULL DEFAULT 'CYFAST',
  metadata JSON NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  created_by VARCHAR(100) NULL,
  created_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (execution_trace_link_id),
  UNIQUE KEY ux_execution_trace_link_identity
    (execution_run_id, link_type, resource_id, resource_version, relationship),
  KEY ix_execution_trace_resource
    (organization_id, project_id, link_type, resource_id),
  KEY ix_execution_trace_run
    (execution_run_id, created_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
