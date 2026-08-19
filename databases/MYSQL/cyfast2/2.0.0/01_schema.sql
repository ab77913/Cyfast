-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS cyfast3;
USE cyfast3;

-- Orchestration table
CREATE TABLE orchestration (
    orchestration_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NOT NULL,

    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NULL,
    status VARCHAR(20) NULL,
    completion_percentage DECIMAL(5, 2) NULL,
    last_execution_id VARCHAR(50) NULL,
    last_executed DATETIME NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    
    PRIMARY KEY (orchestration_id)
) ENGINE=InnoDB;

-- Orchestration configuration table
CREATE TABLE orchestration_configuration (
    orchestration_configuration_id BIGINT AUTO_INCREMENT NOT NULL,
    project_id INT NOT NULL,
    orchestration_id BIGINT NOT NULL,
    orchestration_version VARCHAR(20) NULL,
    
    execution_base VARCHAR(20) NULL,
    continue_on_error TINYINT NULL,
    run_order VARCHAR(20) NULL,
    trigger_criteria VARCHAR(20) NULL,
    scheduled_start_time DATETIME NULL,
    scheduled_end_time DATETIME NULL,
    repeat_interval_unit VARCHAR(20) NULL,
    repeat_interval_value INT NULL,
    
    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (orchestration_configuration_id)
) ENGINE=InnoDB;

-- Orchestration configuration table
CREATE TABLE orchestration_custom_configuration (
    orchestration_configuration_id BIGINT AUTO_INCREMENT NOT NULL,
    project_id INT NOT NULL,
    orchestration_id BIGINT NOT NULL,
    orchestration_version VARCHAR(20) NULL,

    config_name VARCHAR(100) NULL,
    config_value TEXT NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (orchestration_configuration_id)
) ENGINE=InnoDB;

-- Orchestration execution table
CREATE TABLE orchestration_execution (
    orchestration_execution_id VARCHAR(50) NOT NULL,
    project_id INT NOT NULL,
    orchestration_id BIGINT NOT NULL,
    orchestration_version VARCHAR(20) NULL,

    executed_by VARCHAR(100) NULL,
    build_version VARCHAR(20) NULL,
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    elapsed_time INT NULL,
    status VARCHAR(16) NULL,
    pass_percentage DECIMAL(5, 2) NULL,
    completion_percentage DECIMAL(5, 2) NULL,
    total_tests INT NULL,
    result_details TEXT NULL,
    test_agents VARCHAR(512) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (orchestration_execution_id)
) ENGINE=InnoDB;

-- Orchestration test case table
CREATE TABLE orchestration_test_case (
    orchestration_test_case_id BIGINT AUTO_INCREMENT NOT NULL,
    project_id INT NOT NULL,
    orchestration_id BIGINT NOT NULL,
    orchestration_version VARCHAR(20) NULL,

    test_script_id BIGINT NOT NULL,
    test_case_id BIGINT NOT NULL,
    test_case_version VARCHAR(20) NULL,
    execution_order INT NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (orchestration_test_case_id)
) ENGINE=InnoDB;

-- Project table
CREATE TABLE project (
    project_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,

    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NULL,
    build_version VARCHAR(20) NULL,
    description TEXT NULL,
    type VARCHAR(20) NOT NULL,
    phase VARCHAR(20) NULL,
    status VARCHAR(20) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (project_id)
) ENGINE=InnoDB;

-- Project configuration table
CREATE TABLE project_configuration (
    project_configuration_id BIGINT AUTO_INCREMENT NOT NULL,
    project_id INT NOT NULL,

    enable_logging BOOLEAN NULL,
    emails_to_notify TEXT NULL,
    enable_email_notifications BOOLEAN NULL,
    execution_base VARCHAR(20) DEFAULT 'TEST_CASE' NOT NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (project_configuration_id)
) ENGINE=InnoDB;

-- Project configuration table
CREATE TABLE project_custom_configuration (
    project_configuration_id BIGINT AUTO_INCREMENT NOT NULL,
    project_id INT NOT NULL,

    config_name VARCHAR(100) NULL,
    config_value TEXT NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (project_configuration_id)
) ENGINE=InnoDB;

-- Project Test Agent table
CREATE TABLE project_test_agent (
    project_test_agent_id BIGINT AUTO_INCREMENT NOT NULL,
    project_id INT NOT NULL,
    test_agent_id VARCHAR(50) NOT NULL,
    
    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (project_test_agent_id)
) ENGINE=InnoDB;

-- Requirement table
CREATE TABLE requirement (
    requirement_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    traceability_import_id INT NULL,

    requirement_no VARCHAR(50) NULL,
    version VARCHAR(20) NULL,
    title VARCHAR(255) NULL,
    description TEXT NULL,
    status VARCHAR(32) NULL DEFAULT 'ACTIVE',

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (requirement_id)
) ENGINE=InnoDB;

-- Requirement test case table
CREATE TABLE requirement_test_case (
    requirement_test_case_id BIGINT AUTO_INCREMENT NOT NULL,

    project_id INT NULL,
    requirement_id BIGINT NOT NULL,
    requirement_version VARCHAR(20) NULL,
    test_case_id BIGINT NOT NULL,
    test_case_version VARCHAR(20) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (requirement_test_case_id)
) ENGINE=InnoDB;

-- Risk table
CREATE TABLE risk (
    risk_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    traceability_import_id INT NULL,

    risk_no VARCHAR(50) NULL,
    version VARCHAR(20) NULL,
    title VARCHAR(255) NULL,
    description TEXT NULL,
    rpn_number SMALLINT NULL,
    severity SMALLINT NULL,
    occurence SMALLINT NULL,
    detection SMALLINT NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (risk_id)
) ENGINE=InnoDB;

-- Risk Requirement table
CREATE TABLE risk_requirement (
    risk_requirement_id BIGINT AUTO_INCREMENT NOT NULL,

    project_id INT NULL,
    risk_id BIGINT NOT NULL,
    risk_version VARCHAR(20) NULL,
    requirement_id BIGINT NOT NULL,
    requirement_version VARCHAR(20) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (risk_requirement_id)
) ENGINE=InnoDB;

-- Test Agent table
CREATE TABLE test_agent (
    test_agent_id VARCHAR(50) NOT NULL,
    organization_id INT NOT NULL,

    name VARCHAR(100) NULL,
    type VARCHAR(20) NULL,
    host_name VARCHAR(100) NULL,
    host_ip VARCHAR(50) NULL,
    host_os VARCHAR(50) NULL,
    host_architecture VARCHAR(50) NULL,
    supported_execution_modes VARCHAR(250) NULL,
    supported_execution_bases VARCHAR(250) NULL,
    status VARCHAR(20) NULL,
    last_heartbeat DATETIME NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (test_agent_id)
) ENGINE=InnoDB;

-- Test Source table
CREATE TABLE test_source (
    test_source_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,

    source_name VARCHAR(100) NULL,
    source_type VARCHAR(20) NULL,
    is_default BOOLEAN DEFAULT 0 NOT NULL,
    source_path VARCHAR(250) NULL,
    source_cloud_url VARCHAR(250) NULL,
    repository_type VARCHAR(20) NULL,
    repository_server_url VARCHAR(250) NULL,
    repository_branch_name VARCHAR(100) NULL,
    access_username VARCHAR(100) NULL,
    access_password VARCHAR(100) NULL,
    access_token VARCHAR(250) NULL,
    suite_name VARCHAR(100) NULL,
    test_framework VARCHAR(20) NULL,
    test_scripts_count INT NULL,
    test_cases_count INT NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (test_source_id)
) ENGINE=InnoDB;

-- Table: test_case
CREATE TABLE test_case (
    test_case_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    test_source_id INT NULL,
    test_suite_id BIGINT NOT NULL,
    test_script_id BIGINT NOT NULL,

    test_case_no VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(20) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    type VARCHAR(20) DEFAULT NULL,
    priority VARCHAR(20) DEFAULT NULL,
    tags VARCHAR(255) DEFAULT NULL,
    pre_condition TEXT DEFAULT NULL,
    post_condition TEXT DEFAULT NULL,
    test_data TEXT DEFAULT NULL,
    expected_result TEXT DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'NOT_EXECUTED',

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (test_case_id)
) ENGINE=InnoDB;

CREATE TABLE test_case_execution (
    test_case_execution_id VARCHAR(50) NOT NULL,
    project_id INT NOT NULL,
    orchestration_execution_id VARCHAR(50) NULL,
    orchestration_id BIGINT NULL,
    orchestration_version VARCHAR(20) NULL,

    test_suite_id BIGINT NOT NULL,
    test_script_id BIGINT NOT NULL,
    test_case_id BIGINT NOT NULL,
    test_case_version VARCHAR(20) NULL,
    test_case_no VARCHAR(50) NULL,
    test_case_name VARCHAR(250) NULL,
    executed_by VARCHAR(100) NULL,
    build_version VARCHAR(20) NULL,
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    elapsed_time INT NULL,
    status VARCHAR(20) NULL,
    result_details TEXT NULL,
    test_agent_name VARCHAR(50) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (test_case_execution_id)
) ENGINE=InnoDB;


-- Table: test_script
CREATE TABLE test_script (
    test_script_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    test_source_id INT NULL,
    test_suite_id BIGINT NOT NULL,
    
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    file_name VARCHAR(255) DEFAULT NULL,
    file_path VARCHAR(255) DEFAULT NULL,
    content TEXT DEFAULT NULL,
    language VARCHAR(50) DEFAULT NULL,
    
    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (test_script_id)
) ENGINE=InnoDB;

CREATE TABLE test_script_execution (
    test_script_execution_id VARCHAR(50) NOT NULL,
    project_id INT NOT NULL,
    orchestration_execution_id VARCHAR(50) NULL,
    orchestration_id BIGINT NULL,
    orchestration_version VARCHAR(20) NULL,

    test_suite_id BIGINT NOT NULL,
    test_script_id BIGINT NOT NULL,
    test_script_version VARCHAR(20) NULL,
    test_script_name VARCHAR(250) NULL,
    file_path VARCHAR(250) NULL,
    executed_by VARCHAR(100) NULL,
    build_version VARCHAR(20) NULL,
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    elapsed_time INT NULL,
    status VARCHAR(20) NULL,
    result_details TEXT NULL,
    test_agent_name VARCHAR(50) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (test_script_execution_id)
) ENGINE=InnoDB;


-- Table: test_suite
CREATE TABLE test_suite (
    test_suite_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    test_source_id INT NULL,

    name VARCHAR(255) NOT NULL,
    test_framework VARCHAR(20) DEFAULT NULL,
    directory_name VARCHAR(255) NULL,
    directory_path VARCHAR(255) NULL,
    
    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (test_suite_id)
) ENGINE=InnoDB;

-- Table: test_script
CREATE TABLE traceability_import (
    traceability_import_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NULL,
    project_id INT NOT NULL,

    import_type VARCHAR(20) DEFAULT NULL,
    type VARCHAR(20) DEFAULT NULL,
    format VARCHAR(20) DEFAULT NULL,
    status VARCHAR(20) DEFAULT NULL,
    file_name VARCHAR(255) DEFAULT NULL,
    file_type VARCHAR(50) DEFAULT NULL,
    temp_path VARCHAR(255) DEFAULT NULL,
    document_no VARCHAR(50) DEFAULT NULL,
    document_name VARCHAR(50) DEFAULT NULL,
    author VARCHAR(50) DEFAULT NULL,
    purpose VARCHAR(50) DEFAULT NULL,
    version VARCHAR(20) DEFAULT NULL,
    total_records INT NOT NULL DEFAULT 0,
    records_imported INT NOT NULL DEFAULT 0,
    
    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (traceability_import_id)
) ENGINE=InnoDB;

-- Organization table
CREATE TABLE organization (
    organization_id INT AUTO_INCREMENT NOT NULL,

    name VARCHAR(100) NULL,
    domain VARCHAR(20) NULL,
    client_id VARCHAR(50) NULL,
    client_secret VARCHAR(100) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (organization_id)
) ENGINE=InnoDB;

-- Permission table
CREATE TABLE permission (
    permission_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,

    name VARCHAR(100) NULL,
    description TEXT NULL,
    permission_type VARCHAR(50) NULL,
    permission_value VARCHAR(50) NULL,
    is_active TINYINT(1) DEFAULT 1,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (permission_id)
) ENGINE=InnoDB;

-- Table: user
CREATE TABLE user (
    user_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,

    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_no VARCHAR(20) DEFAULT NULL,
    first_name VARCHAR(50) DEFAULT NULL,
    last_name VARCHAR(50) DEFAULT NULL,
    access_token VARCHAR(255) DEFAULT NULL,
    refresh_token VARCHAR(255) DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    last_login DATETIME DEFAULT NULL,

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (user_id)
) ENGINE=InnoDB;

-- Table: role
CREATE TABLE role (
    role_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,

    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    parent_role_id INT DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (role_id)
) ENGINE=InnoDB;

-- Table: user_role
CREATE TABLE user_role (
    user_role_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,

    user_id INT NOT NULL,
    role_id INT NOT NULL,

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (user_role_id)
) ENGINE=InnoDB;

-- Table: role_permission
CREATE TABLE role_permission (
    role_permission_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,

    role_id INT NOT NULL,
    permission_id INT NOT NULL,

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (role_permission_id)
) ENGINE=InnoDB;

-- Project Document table (Gen AI V&V document ingestion)
-- Raw bytes live in storage_service. Parsed hierarchical chunks (PageIndex tree)
-- live in MongoDB collection `project_document_chunks` linked via project_document_id.
CREATE TABLE project_document (
    project_document_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NOT NULL,

    doc_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NULL,
    version VARCHAR(50) NULL,
    description TEXT NULL,
    author VARCHAR(150) NULL,
    language VARCHAR(20) NULL,
    source VARCHAR(20) DEFAULT 'UPLOAD' NOT NULL,

    storage_file_id VARCHAR(100) NULL,
    storage_file_url VARCHAR(500) NULL,
    original_filename VARCHAR(255) NULL,
    stored_filename VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,

    status VARCHAR(20) DEFAULT 'UPLOADED' NOT NULL,
    parse_status_detail TEXT NULL,
    chunk_count INT DEFAULT 0 NULL,
    page_count INT NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (project_document_id),
    INDEX idx_project_document_project (project_id),
    INDEX idx_project_document_type (project_id, doc_type),
    INDEX idx_project_document_status (project_id, status)
) ENGINE=InnoDB;

CREATE TABLE job (
    job_id BIGINT AUTO_INCREMENT NOT NULL,
    project_id INT NOT NULL,
    organization_id INT NOT NULL,
    job_type VARCHAR(48) NOT NULL DEFAULT 'REQUIREMENT_GENERATION',
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
    requirement_categories JSON NOT NULL,
    source_document_ids JSON NOT NULL,
    scenario_types JSON NULL,
    scenario_requirement_ids JSON NULL,
    scenario_safety_options JSON NULL,
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

CREATE TABLE generated_requirement (
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

CREATE TABLE test_scenario (
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

CREATE TABLE generated_test_scenario (
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

CREATE TABLE user_notification (
    user_notification_id BIGINT AUTO_INCREMENT NOT NULL,
    user_id INT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    title VARCHAR(255) NOT NULL,
    body TEXT NULL,
    reference_type VARCHAR(64) NULL,
    reference_id VARCHAR(128) NULL,
    read_at DATETIME NULL,
    read_by VARCHAR(100) NULL,
    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (user_notification_id),
    CONSTRAINT fk_usernoti_user FOREIGN KEY (user_id) REFERENCES user (user_id)
        ON DELETE CASCADE,
    INDEX idx_usernoti_user_read (user_id, read_at),
    INDEX idx_usernoti_user_created (user_id, created_date)
) ENGINE=InnoDB;

-- Table: project_user
CREATE TABLE project_user (
    project_user_id INT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,

    project_id INT NOT NULL,
    user_id INT NULL,
    username VARCHAR(100) NULL,

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (project_user_id)
) ENGINE=InnoDB;
