-- Test case AI generation from approved test scenarios.
-- Safe to run once on existing deployments that already have `job` / `generated_test_scenario`.

ALTER TABLE job
    ADD COLUMN test_case_scenario_ids JSON NULL AFTER scenario_safety_options;

CREATE TABLE IF NOT EXISTS generated_test_case (
    generated_test_case_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NOT NULL,
    job_id BIGINT NULL,
    requirement_id BIGINT NULL,
    requirement_no VARCHAR(100) NULL,
    test_scenario_id BIGINT NULL,
    scenario_title VARCHAR(255) NULL,
    test_case_no VARCHAR(100) NULL,
    test_case_name VARCHAR(255) NOT NULL,
    test_case_description TEXT NULL,
    test_type VARCHAR(64) NULL,
    priority VARCHAR(32) NULL,
    preconditions TEXT NULL,
    test_steps JSON NULL,
    test_data TEXT NULL,
    expected_result TEXT NULL,
    tags TEXT NULL,
    automation_percentage SMALLINT NULL,
    approval_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    promoted_test_case_id BIGINT NULL,
    approved_by VARCHAR(100) NULL,
    approved_date DATETIME NULL,
    rejected_reason TEXT NULL,
    source_payload JSON NULL,
    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (generated_test_case_id),
    INDEX idx_gtc_project (project_id),
    INDEX idx_gtc_job (job_id),
    INDEX idx_gtc_pending (approval_status),
    INDEX idx_gtc_requirement (requirement_id),
    INDEX idx_gtc_scenario (test_scenario_id),
    CONSTRAINT fk_gtc_job FOREIGN KEY (job_id) REFERENCES job (job_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_gtc_requirement FOREIGN KEY (requirement_id) REFERENCES requirement (requirement_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_gtc_scenario FOREIGN KEY (test_scenario_id) REFERENCES test_scenario (test_scenario_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_gtc_promoted FOREIGN KEY (promoted_test_case_id) REFERENCES test_case (test_case_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;
