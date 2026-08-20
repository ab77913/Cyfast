CREATE TABLE IF NOT EXISTS quality_lifecycle_execution_link (
  quality_lifecycle_execution_link_id VARCHAR(64) NOT NULL,
  organization_id INT NOT NULL,
  project_id INT NOT NULL,
  quality_lifecycle_id VARCHAR(64) NOT NULL,
  execution_run_id VARCHAR(64) NOT NULL,
  root_execution_run_id VARCHAR(64) NOT NULL,
  relationship VARCHAR(32) NOT NULL DEFAULT 'PRIMARY',
  status_snapshot VARCHAR(32) NOT NULL,
  created_by VARCHAR(100) NULL,
  created_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modified_by VARCHAR(100) NULL,
  modified_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (quality_lifecycle_execution_link_id),
  UNIQUE KEY ux_quality_lifecycle_execution_link
    (quality_lifecycle_id, execution_run_id),
  KEY ix_quality_lifecycle_execution_scope
    (organization_id, project_id, quality_lifecycle_id, status_snapshot),
  KEY ix_quality_lifecycle_execution_root
    (root_execution_run_id, created_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
