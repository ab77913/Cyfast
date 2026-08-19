USE cyfast3;

-- test executions
TRUNCATE TABLE test_case_execution;
TRUNCATE TABLE test_script_execution;
TRUNCATE TABLE orchestration_execution;

-- traceability
TRUNCATE TABLE traceability_import;
TRUNCATE TABLE orchestration_test_case;
TRUNCATE TABLE risk_requirement;
TRUNCATE TABLE requirement_test_case;

-- AI requirement generation (before requirement: FK promoted_requirement_id → requirement)
TRUNCATE TABLE generated_requirement;

-- AI test scenario generation (before requirement)
TRUNCATE TABLE generated_test_scenario;
TRUNCATE TABLE test_scenario;

DELETE FROM job WHERE job_id >= 1;
ALTER TABLE job AUTO_INCREMENT = 1;

TRUNCATE TABLE test_case;
TRUNCATE TABLE test_script;
TRUNCATE TABLE test_suite;
TRUNCATE TABLE test_source;
TRUNCATE TABLE risk;
DELETE FROM requirement WHERE requirement_id >= 1;
ALTER TABLE requirement AUTO_INCREMENT = 1;


-- orchestration
TRUNCATE TABLE orchestration_configuration;
TRUNCATE TABLE orchestration_custom_configuration;
TRUNCATE TABLE orchestration;

-- project management / documents (before project delete)
TRUNCATE TABLE project_document;
TRUNCATE TABLE project_configuration;
TRUNCATE TABLE project_custom_configuration;
TRUNCATE TABLE project_test_agent;
TRUNCATE TABLE project_user;

DELETE FROM project WHERE project_id >= 1;
ALTER TABLE project AUTO_INCREMENT = 1;

-- notifications (references user — clear before pruning users if needed)
TRUNCATE TABLE user_notification;

DELETE FROM user_role WHERE user_id > 5;
DELETE FROM user WHERE user_id > 5;

-- drop tables
-- DROP TABLE Project, Product, TERD, UserTable, UserCredentials;
