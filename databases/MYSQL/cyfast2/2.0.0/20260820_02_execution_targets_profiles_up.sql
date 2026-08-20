-- CyFAST managed execution targets and immutable application/device profiles.
-- Additive only. Rows are revoked/versioned, never automatically deleted.

CREATE TABLE IF NOT EXISTS execution_profiles (
    profile_id CHAR(36) NOT NULL,
    profile_version INT UNSIGNED NOT NULL,
    organization_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    profile_type VARCHAR(64) NOT NULL,
    configuration_snapshot JSON NOT NULL,
    configuration_sha256 CHAR(64) NOT NULL,
    minimum_agent_version VARCHAR(64) NULL,
    created_by VARCHAR(128) NULL,
    created_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    revoked_by VARCHAR(128) NULL,
    PRIMARY KEY (profile_id, profile_version),
    UNIQUE KEY uq_execution_profile_name_version (
        organization_id,
        project_id,
        name,
        profile_version
    ),
    KEY idx_execution_profiles_scope_active (
        organization_id,
        project_id,
        platform,
        revoked_at,
        created_at
    ),
    CONSTRAINT chk_execution_profile_version CHECK (profile_version >= 1),
    CONSTRAINT chk_execution_profile_sha CHECK (
        configuration_sha256 REGEXP '^[0-9A-Fa-f]{64}$'
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS execution_targets (
    id CHAR(36) NOT NULL,
    organization_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    transport VARCHAR(64) NOT NULL,
    base_url VARCHAR(2048) NULL,
    credential_reference VARCHAR(512) NULL,
    capabilities JSON NOT NULL,
    endpoint_configuration JSON NULL,
    profile_id CHAR(36) NULL,
    profile_version INT UNSIGNED NULL,
    device_profile_id VARCHAR(128) NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'OFFLINE',
    status_reason VARCHAR(1024) NULL,
    health_snapshot JSON NULL,
    last_seen_at DATETIME(6) NULL,
    minimum_agent_version VARCHAR(64) NULL,
    registered_agent_version VARCHAR(64) NULL,
    target_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    created_by VARCHAR(128) NULL,
    updated_by VARCHAR(128) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    revoked_by VARCHAR(128) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_execution_target_name (
        organization_id,
        project_id,
        name
    ),
    KEY idx_execution_targets_scope_status (
        organization_id,
        project_id,
        platform,
        status,
        revoked_at,
        updated_at
    ),
    KEY idx_execution_targets_profile (profile_id, profile_version),
    CONSTRAINT fk_execution_targets_profile
        FOREIGN KEY (profile_id, profile_version)
        REFERENCES execution_profiles(profile_id, profile_version)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_execution_target_version CHECK (target_version >= 1),
    CONSTRAINT chk_execution_target_profile_pair CHECK (
        (profile_id IS NULL AND profile_version IS NULL)
        OR (profile_id IS NOT NULL AND profile_version IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS execution_target_health_events (
    id CHAR(36) NOT NULL,
    target_id CHAR(36) NOT NULL,
    organization_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    status VARCHAR(64) NOT NULL,
    status_reason VARCHAR(1024) NULL,
    health_snapshot JSON NULL,
    checked_by VARCHAR(128) NULL,
    checked_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_target_health_scope_time (
        organization_id,
        project_id,
        target_id,
        checked_at
    ),
    CONSTRAINT fk_target_health_target
        FOREIGN KEY (target_id) REFERENCES execution_targets(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
