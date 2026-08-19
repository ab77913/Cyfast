USE cyfast3;
GO

-- test executions
TRUNCATE TABLE test_case_execution;
TRUNCATE TABLE test_script_execution;
TRUNCATE TABLE orchestration_execution;
GO

-- traceability
TRUNCATE TABLE traceability_import;
TRUNCATE TABLE orchestration_test_case;
TRUNCATE TABLE risk_requirement;
TRUNCATE TABLE requirement_test_case;
GO

TRUNCATE TABLE test_case;
TRUNCATE TABLE test_script;
TRUNCATE TABLE test_suite;
TRUNCATE TABLE test_source;
TRUNCATE TABLE risk;
TRUNCATE TABLE requirement;
GO

-- orchestration
TRUNCATE TABLE orchestration_configuration;
TRUNCATE TABLE orchestration_custom_configuration;
TRUNCATE TABLE orchestration;
GO

-- project management
TRUNCATE TABLE project_configuration;
TRUNCATE TABLE project_custom_configuration;
GO

DELETE FROM project WHERE project_id >= 1;
DBCC CHECKIDENT ('project', RESEED, 0);
GO

DELETE FROM [user] WHERE user_id > 5;
GO

-- drop tables (commented out by default)
-- DROP TABLE project, orchestration, test_case, test_script;
