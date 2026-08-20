-- CyFAST Phase A execution lifecycle persistence (MySQL 8+)
-- Additive only. No existing table, row, or audit evidence is deleted.

CREATE TABLE IF NOT EXISTS execution_runs (
    id CHAR(36) NOT NULL,
    organization_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL,
    status_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(256) NOT NULL,
    correlation_id VARCHAR(128) NOT NULL,
    requirement_id VARCHAR(128) NULL,
    scenario_id VARCHAR(128) NULL,
    test_case_id VARCHAR(128) NULL,
    test_script_id VARCHAR(128) NULL,
    package_snapshot JSON NOT NULL,
    package_sha256 CHAR(64) NOT NULL,
    target_snapshot JSON NOT NULL,
    target_id VARCHAR(128) NULL,
    requested_by VARCHAR(128) NULL,
    repair_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    attempt_number INT UNSIGNED NOT NULL DEFAULT 0,
    cancel_requested TINYINT(1) NOT NULL DEFAULT 0,
    cancel_requested_by VARCHAR(128) NULL,
    cancel_requested_at DATETIME(6) NULL,
    runtime_proof JSON NULL,
    runtime_proof_verified_at DATETIME(6) NULL,
    result_proof JSON NULL,
    last_result JSON NULL,
    artifact_count INT UNSIGNED NOT NULL DEFAULT 0,
    failure_classification VARCHAR(64) NULL,
    failure_code VARCHAR(128) NULL,
    failure_message VARCHAR(4096) NULL,
    defect_id VARCHAR(128) NULL,
    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_execution_runs_idempotency (
        organization_id,
        project_id,
        idempotency_key
    ),
    KEY idx_execution_runs_scope_status_created (
        organization_id,
        project_id,
        status,
        created_at,
        id
    ),
    KEY idx_execution_runs_target_status (
        target_id,
        status,
        updated_at
    ),
    KEY idx_execution_runs_correlation (correlation_id),
    KEY idx_execution_runs_traceability (
        requirement_id,
        scenario_id,
        test_case_id,
        test_script_id
    ),
    CONSTRAINT chk_execution_runs_status_version CHECK (status_version >= 1),
    CONSTRAINT chk_execution_runs_repair_attempts CHECK (repair_attempts <= 10),
    CONSTRAINT chk_execution_runs_package_sha CHECK (package_sha256 REGEXP '^[0-9A-Fa-f]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS execution_attempts (
    id CHAR(36) NOT NULL,
    execution_id CHAR(36) NOT NULL,
    organization_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    attempt_number INT UNSIGNED NOT NULL,
    package_sha256 CHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL,
    runtime_proof JSON NULL,
    result_proof JSON NULL,
    raw_result JSON NULL,
    failure_classification VARCHAR(64) NULL,
    failure_code VARCHAR(128) NULL,
    failure_message VARCHAR(4096) NULL,
    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_execution_attempt_number (execution_id, attempt_number),
    KEY idx_execution_attempts_scope_created (
        organization_id,
        project_id,
        created_at,
        id
    ),
    CONSTRAINT fk_execution_attempts_run
        FOREIGN KEY (execution_id) REFERENCES execution_runs(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_execution_attempts_number CHECK (attempt_number >= 1),
    CONSTRAINT chk_execution_attempts_package_sha CHECK (package_sha256 REGEXP '^[0-9A-Fa-f]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS execution_events (
    id CHAR(36) NOT NULL,
    execution_id CHAR(36) NOT NULL,
    organization_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    sequence BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    status VARCHAR(64) NOT NULL,
    details JSON NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_execution_events_sequence (execution_id, sequence),
    KEY idx_execution_events_scope_created (
        organization_id,
        project_id,
        created_at,
        id
    ),
    KEY idx_execution_events_stream (execution_id, sequence),
    CONSTRAINT fk_execution_events_run
        FOREIGN KEY (execution_id) REFERENCES execution_runs(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_execution_events_sequence CHECK (sequence >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS execution_artifacts (
    id CHAR(36) NOT NULL,
    execution_id CHAR(36) NOT NULL,
    attempt_number INT UNSIGNED NOT NULL,
    organization_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    artifact_type VARCHAR(128) NOT NULL,
    file_name VARCHAR(512) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL,
    sha256 CHAR(64) NOT NULL,
    storage_reference VARCHAR(2048) NOT NULL,
    download_reference VARCHAR(2048) NULL,
    expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_execution_artifact_checksum (
        execution_id,
        attempt_number,
        artifact_type,
        sha256
    ),
    KEY idx_execution_artifacts_scope_created (
        organization_id,
        project_id,
        created_at,
        id
    ),
    KEY idx_execution_artifacts_execution_attempt (
        execution_id,
        attempt_number,
        created_at
    ),
    CONSTRAINT fk_execution_artifacts_run
        FOREIGN KEY (execution_id) REFERENCES execution_runs(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_execution_artifacts_attempt CHECK (attempt_number >= 1),
    CONSTRAINT chk_execution_artifacts_size CHECK (size_bytes >= 0),
    CONSTRAINT chk_execution_artifacts_sha CHECK (sha256 REGEXP '^[0-9A-Fa-f]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS execution_defect_links (
    id CHAR(36) NOT NULL,
    execution_id CHAR(36) NOT NULL,
    attempt_number INT UNSIGNED NOT NULL,
    organization_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    defect_id VARCHAR(128) NOT NULL,
    failure_classification VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_execution_defect_link (
        execution_id,
        attempt_number,
        defect_id
    ),
    KEY idx_execution_defect_links_scope_defect (
        organization_id,
        project_id,
        defect_id
    ),
    CONSTRAINT fk_execution_defect_links_run
        FOREIGN KEY (execution_id) REFERENCES execution_runs(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_execution_defect_attempt CHECK (attempt_number >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
