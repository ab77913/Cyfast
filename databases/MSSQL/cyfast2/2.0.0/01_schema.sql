-- Create the database if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'cyfast3')
BEGIN
    CREATE DATABASE cyfast3;
END
GO

USE cyfast3;
GO

-- Orchestration table
CREATE TABLE orchestration (
    orchestration_id BIGINT IDENTITY(1,1) NOT NULL,
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
);
GO

-- Orchestration configuration table
CREATE TABLE orchestration_configuration (
    orchestration_configuration_id BIGINT IDENTITY(1,1) NOT NULL,
    project_id INT NOT NULL,
    orchestration_id BIGINT NOT NULL,
    orchestration_version VARCHAR(20) NULL,
    
    execution_base VARCHAR(20) NULL,
    continue_on_error BIT NULL,
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
);
GO

-- Orchestration configuration table
CREATE TABLE orchestration_custom_configuration (
    orchestration_configuration_id BIGINT IDENTITY(1,1) NOT NULL,
    project_id INT NOT NULL,
    orchestration_id BIGINT NOT NULL,
    orchestration_version VARCHAR(20) NULL,

    config_name VARCHAR(100) NULL,
    config_value VARCHAR(MAX) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (orchestration_configuration_id)
);
GO

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
    result_details VARCHAR(MAX) NULL,
    test_agents VARCHAR(512) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (orchestration_execution_id)
);
GO

-- Orchestration test case table
CREATE TABLE orchestration_test_case (
    orchestration_test_case_id BIGINT IDENTITY(1,1) NOT NULL,
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
);
GO

-- Project table
CREATE TABLE project (
    project_id INT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,

    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NULL,
    build_version VARCHAR(20) NULL,
    description VARCHAR(MAX) NULL,
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
);
GO

-- Project configuration table
CREATE TABLE project_configuration (
    project_configuration_id BIGINT IDENTITY(1,1) NOT NULL,
    project_id INT NOT NULL,

    enable_logging BIT NULL,
    emails_to_notify VARCHAR(MAX) NULL,
    enable_email_notifications BIT NULL,
    execution_base VARCHAR(20) DEFAULT 'TEST_CASE' NOT NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (project_configuration_id)
);
GO

-- Project configuration table
CREATE TABLE project_custom_configuration (
    project_configuration_id BIGINT IDENTITY(1,1) NOT NULL,
    project_id INT NOT NULL,

    config_name VARCHAR(100) NULL,
    config_value VARCHAR(MAX) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (project_configuration_id)
);
GO

-- Project Test Agent table
CREATE TABLE project_test_agent (
    project_test_agent_id BIGINT IDENTITY(1,1) NOT NULL,
    project_id INT NOT NULL,
    test_agent_id VARCHAR(50) NOT NULL,
    
    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (project_test_agent_id)
);
GO

-- Requirement table
CREATE TABLE requirement (
    requirement_id BIGINT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    traceability_import_id INT NULL,

    requirement_no VARCHAR(50) NULL,
    version VARCHAR(20) NULL,
    title VARCHAR(255) NULL,
    description VARCHAR(MAX) NULL,
    
    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (requirement_id)
);
GO

-- Requirement test case table
CREATE TABLE requirement_test_case (
    requirement_test_case_id BIGINT IDENTITY(1,1) NOT NULL,

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
);
GO

-- Risk table
CREATE TABLE risk (
    risk_id BIGINT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    traceability_import_id INT NULL,

    risk_no VARCHAR(50) NULL,
    version VARCHAR(20) NULL,
    title VARCHAR(255) NULL,
    description VARCHAR(MAX) NULL,
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
);
GO

-- Risk Requirement table
CREATE TABLE risk_requirement (
    risk_requirement_id BIGINT IDENTITY(1,1) NOT NULL,

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
);
GO

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
);
GO

-- Test Source table
CREATE TABLE test_source (
    test_source_id INT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,

    source_name VARCHAR(100) NULL,
    source_type VARCHAR(20) NULL,
    is_default BIT DEFAULT 0 NOT NULL,
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
);
GO

-- Table: test_case
CREATE TABLE test_case (
    test_case_id BIGINT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    test_source_id INT NULL,
    test_suite_id BIGINT NOT NULL,
    test_script_id BIGINT NOT NULL,

    test_case_no VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(20) DEFAULT NULL,
    description VARCHAR(MAX) DEFAULT NULL,
    type VARCHAR(20) DEFAULT NULL,
    priority VARCHAR(20) DEFAULT NULL,
    tags VARCHAR(255) DEFAULT NULL,
    pre_condition VARCHAR(MAX) DEFAULT NULL,
    post_condition VARCHAR(MAX) DEFAULT NULL,
    test_data VARCHAR(MAX) DEFAULT NULL,
    expected_result VARCHAR(MAX) DEFAULT NULL,

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (test_case_id)
);
GO

CREATE TABLE test_case_execution (
    test_case_execution_id VARCHAR(50) NOT NULL,
    project_id INT NOT NULL,
    orchestration_execution_id VARCHAR(50) NOT NULL,
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
    result_details VARCHAR(MAX) NULL,
    test_agent_name VARCHAR(50) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (test_case_execution_id)
);
GO


-- Table: test_script
CREATE TABLE test_script (
    test_script_id BIGINT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NULL,
    test_source_id INT NULL,
    test_suite_id BIGINT NOT NULL,
    
    name VARCHAR(255) NOT NULL,
    description VARCHAR(MAX) DEFAULT NULL,
    file_name VARCHAR(255) DEFAULT NULL,
    file_path VARCHAR(255) DEFAULT NULL,
    content VARCHAR(MAX) DEFAULT NULL,
    language VARCHAR(50) DEFAULT NULL,
    
    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (test_script_id)
);
GO

CREATE TABLE test_script_execution (
    test_script_execution_id VARCHAR(50) NOT NULL,
    project_id INT NOT NULL,
    orchestration_execution_id VARCHAR(50) NOT NULL,
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
    result_details VARCHAR(MAX) NULL,
    test_agent_name VARCHAR(50) NULL,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (test_script_execution_id)
);
GO


-- Table: test_suite
CREATE TABLE test_suite (
    test_suite_id BIGINT IDENTITY(1,1) NOT NULL,
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
);
GO

-- Table: traceability_import
CREATE TABLE traceability_import (
    traceability_import_id INT IDENTITY(1,1) NOT NULL,
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
);
GO

-- Organization table
CREATE TABLE organization (
    organization_id INT IDENTITY(1,1) NOT NULL,

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
);
GO

-- Permission table
CREATE TABLE permission (
    permission_id INT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,

    name VARCHAR(100) NULL,
    description VARCHAR(MAX) NULL,
    permission_type VARCHAR(50) NULL,
    permission_value VARCHAR(50) NULL,
    is_active BIT DEFAULT 1,

    created_by VARCHAR(100) NULL,
    created_date DATETIME NULL,
    modified_by VARCHAR(100) NULL,
    modified_date DATETIME NULL,
    deleted_by VARCHAR(100) NULL,
    deleted_date DATETIME NULL,
    PRIMARY KEY (permission_id)
);
GO

-- Table: user
CREATE TABLE [user] (
    user_id INT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,

    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_no VARCHAR(20) DEFAULT NULL,
    first_name VARCHAR(50) DEFAULT NULL,
    last_name VARCHAR(50) DEFAULT NULL,
    access_token VARCHAR(255) DEFAULT NULL,
    refresh_token VARCHAR(255) DEFAULT NULL,
    is_active BIT DEFAULT 1,
    last_login DATETIME DEFAULT NULL,

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (user_id)
);
GO

-- Table: role
CREATE TABLE role (
    role_id INT IDENTITY(1,1) NOT NULL,
    organization_id INT NOT NULL,

    name VARCHAR(100) NOT NULL,
    description VARCHAR(MAX) DEFAULT NULL,
    parent_role_id INT DEFAULT NULL,
    is_active BIT DEFAULT 1,

    created_by VARCHAR(100) DEFAULT NULL,
    created_date DATETIME DEFAULT NULL,
    modified_by VARCHAR(100) DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    deleted_by VARCHAR(100) DEFAULT NULL,
    deleted_date DATETIME DEFAULT NULL,
    PRIMARY KEY (role_id)
);
GO

-- Table: user_role
CREATE TABLE user_role (
    user_role_id INT IDENTITY(1,1) NOT NULL,
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
);
GO

-- Table: role_permission
CREATE TABLE role_permission (
    role_permission_id INT IDENTITY(1,1) NOT NULL,
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
);
GO

-- Table: project_user
CREATE TABLE project_user (
    project_user_id INT IDENTITY(1,1) NOT NULL,
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
);
GO
