-- Test scenario AI generation (aligned with requirement_generation jobs).
-- Safe to run once on existing deployments that already have `job` / `generated_requirement`.

ALTER TABLE job
    ADD COLUMN scenario_types JSON NULL AFTER source_document_ids,
    ADD COLUMN scenario_requirement_ids JSON NULL AFTER scenario_types,
    ADD COLUMN scenario_safety_options JSON NULL AFTER scenario_requirement_ids;

CREATE TABLE IF NOT EXISTS test_scenario (
    test_scenario_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NOT NULL,
    scenario_no VARCHAR(100) NOT NULL,
    scenario_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    objective TEXT NULL,
    priority VARCHAR(32) NULL,
    automation_possibility_score SMALLINT NULL,
    automation_rationale TEXT NULL,
    description TEXT NULL,
    preconditions TEXT NULL,
    test_steps JSON NULL,
    test_data TEXT NULL,
    expected_results TEXT NULL,
    actual_results TEXT NULL,
    postconditions TEXT NULL,
    requirement_id BIGINT NOT NULL,
    requirement_version VARCHAR(20) NULL,
    dedupe_hash CHAR(64) NULL,
    generated_from_job_id BIGINT NULL,
    promoted_from_candidate_id BIGINT NULL,
    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (test_scenario_id),
    UNIQUE KEY uk_test_scenario_project_no (project_id, scenario_no),
    INDEX idx_ts_project_req (project_id, requirement_id),
    INDEX idx_ts_dedupe (project_id, dedupe_hash),
    CONSTRAINT fk_ts_requirement FOREIGN KEY (requirement_id) REFERENCES requirement (requirement_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_ts_job FOREIGN KEY (generated_from_job_id) REFERENCES job (job_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generated_test_scenario (
    generated_test_scenario_id BIGINT AUTO_INCREMENT NOT NULL,
    job_id BIGINT NOT NULL,
    requirement_id BIGINT NOT NULL,
    requirement_version VARCHAR(20) NULL,
    scenario_type VARCHAR(64) NOT NULL,
    scenario_no VARCHAR(100) NULL,
    title VARCHAR(255) NOT NULL,
    objective TEXT NULL,
    priority VARCHAR(32) NULL,
    automation_possibility_score SMALLINT NULL,
    automation_rationale TEXT NULL,
    description TEXT NULL,
    preconditions TEXT NULL,
    test_steps JSON NULL,
    test_data TEXT NULL,
    expected_results TEXT NULL,
    postconditions TEXT NULL,
    dedupe_hash CHAR(64) NULL,
    approval_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    promoted_test_scenario_id BIGINT NULL,
    approved_by VARCHAR(100) NULL,
    approved_date DATETIME NULL,
    rejected_reason TEXT NULL,
    created_date DATETIME NULL,
    modified_date DATETIME NULL,
    PRIMARY KEY (generated_test_scenario_id),
    INDEX idx_gts_job (job_id),
    INDEX idx_gts_pending (approval_status),
    CONSTRAINT fk_gts_job FOREIGN KEY (job_id) REFERENCES job (job_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_gts_requirement FOREIGN KEY (requirement_id) REFERENCES requirement (requirement_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_gts_promoted FOREIGN KEY (promoted_test_scenario_id) REFERENCES test_scenario (test_scenario_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;
