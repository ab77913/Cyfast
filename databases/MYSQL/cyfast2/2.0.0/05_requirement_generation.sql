-- Incremental install / legacy DBs: safe if tables already exist from 01_schema.sql
CREATE TABLE IF NOT EXISTS job (
    job_id BIGINT AUTO_INCREMENT NOT NULL,
    project_id INT NOT NULL,
    organization_id INT NOT NULL,
    job_type VARCHAR(48) NOT NULL DEFAULT 'REQUIREMENT_GENERATION',
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
    requirement_categories JSON NOT NULL,
    source_document_ids JSON NOT NULL,
    additional_instructions TEXT NULL,
    user_feedback TEXT NULL,
    previous_job_id BIGINT NULL,
    raw_llm_response MEDIUMTEXT NULL,
    error_message TEXT NULL,
    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_date DATETIME NULL,
    PRIMARY KEY (job_id),
    INDEX idx_job_project_type (project_id, job_type, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generated_requirement (
    generated_requirement_id BIGINT AUTO_INCREMENT NOT NULL,
    job_id BIGINT NOT NULL,
    requirement_category VARCHAR(64) NOT NULL,
    requirement_no VARCHAR(64) NULL,
    title VARCHAR(255) NULL,
    description TEXT NULL,
    rationale TEXT NULL,
    approval_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    promoted_requirement_id BIGINT NULL,
    approved_by VARCHAR(100) NULL,
    approved_date DATETIME NULL,
    rejected_reason TEXT NULL,
    created_date DATETIME NULL,
    modified_date DATETIME NULL,
    PRIMARY KEY (generated_requirement_id),
    INDEX idx_genreq_job (job_id),
    INDEX idx_genreq_approval (approval_status),
    CONSTRAINT fk_genreq_job FOREIGN KEY (job_id) REFERENCES job (job_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_genreq_promoted FOREIGN KEY (promoted_requirement_id) REFERENCES requirement (requirement_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- If `requirement.status` is missing on an older database, run once:
-- ALTER TABLE requirement ADD COLUMN status VARCHAR(32) NULL DEFAULT 'ACTIVE' AFTER description;
