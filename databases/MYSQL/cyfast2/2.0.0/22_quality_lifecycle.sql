CREATE TABLE IF NOT EXISTS quality_lifecycle (
  quality_lifecycle_id VARCHAR(64) NOT NULL,
  organization_id INT NOT NULL,
  project_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  source_document_file_id VARCHAR(128) NOT NULL,
  source_document_hash VARCHAR(64) NOT NULL,
  source_document_version VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'DOCUMENT_UPLOADED',
  current_stage VARCHAR(64) NOT NULL DEFAULT 'DOCUMENT',
  generation_policy JSON NOT NULL,
  acceptance_policy JSON NOT NULL,
  traceability_complete TINYINT(1) NOT NULL DEFAULT 0,
  ready_for_execution TINYINT(1) NOT NULL DEFAULT 0,
  active_execution_run_id VARCHAR(64) NULL,
  completed_execution_run_id VARCHAR(64) NULL,
  version INT NOT NULL DEFAULT 1,
  created_by VARCHAR(100) NULL,
  created_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modified_by VARCHAR(100) NULL,
  modified_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_by VARCHAR(100) NULL,
  deleted_date DATETIME(3) NULL,
  PRIMARY KEY (quality_lifecycle_id),
  KEY ix_quality_lifecycle_scope_status (organization_id, project_id, status, created_date),
  KEY ix_quality_lifecycle_document (source_document_file_id, source_document_version),
  KEY ix_quality_lifecycle_execution (active_execution_run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quality_lifecycle_item (
  quality_lifecycle_item_id VARCHAR(64) NOT NULL,
  quality_lifecycle_id VARCHAR(64) NOT NULL,
  organization_id INT NOT NULL,
  project_id INT NOT NULL,
  item_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128) NOT NULL,
  resource_version VARCHAR(128) NOT NULL,
  source_item_id VARCHAR(64) NULL,
  source_anchor JSON NOT NULL,
  generation_metadata JSON NOT NULL,
  approval_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  approved_by VARCHAR(100) NULL,
  approved_at DATETIME(3) NULL,
  content_hash VARCHAR(64) NOT NULL,
  created_by VARCHAR(100) NULL,
  created_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modified_by VARCHAR(100) NULL,
  modified_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_by VARCHAR(100) NULL,
  deleted_date DATETIME(3) NULL,
  PRIMARY KEY (quality_lifecycle_item_id),
  UNIQUE KEY ux_quality_lifecycle_item_version
    (quality_lifecycle_id, item_type, resource_id, resource_version),
  KEY ix_quality_lifecycle_item_scope
    (organization_id, project_id, item_type, approval_status),
  KEY ix_quality_lifecycle_item_source
    (quality_lifecycle_id, source_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quality_lifecycle_event (
  quality_lifecycle_event_id VARCHAR(64) NOT NULL,
  quality_lifecycle_id VARCHAR(64) NOT NULL,
  organization_id INT NOT NULL,
  project_id INT NOT NULL,
  sequence_number BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  actor_type VARCHAR(32) NOT NULL,
  actor_id VARCHAR(100) NULL,
  payload JSON NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_by VARCHAR(100) NULL,
  created_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (quality_lifecycle_event_id),
  UNIQUE KEY ux_quality_lifecycle_event_sequence (quality_lifecycle_id, sequence_number),
  KEY ix_quality_lifecycle_event_scope
    (organization_id, project_id, event_type, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
