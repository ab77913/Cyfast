-- Roll back Windows Connect W1 tables. Permission rows are retained to avoid
-- deleting administrator-managed role mappings.
DROP TABLE IF EXISTS windows_outbox_event;
DROP TABLE IF EXISTS windows_audit_event;
DROP TABLE IF EXISTS execution_evidence;
DROP TABLE IF EXISTS execution_command_result;
DROP TABLE IF EXISTS execution_command;
DROP TABLE IF EXISTS ui_element;
DROP TABLE IF EXISTS ui_snapshot;
DROP TABLE IF EXISTS interactive_session;
DROP TABLE IF EXISTS windows_application_profile;
DROP TABLE IF EXISTS windows_node;
DROP TABLE IF EXISTS agent_health;
DROP TABLE IF EXISTS agent_capability;
DROP TABLE IF EXISTS agent_installation;
DROP TABLE IF EXISTS agent_certificate;
DROP TABLE IF EXISTS agent_identity;
DROP TABLE IF EXISTS agent_enrollment_token;
