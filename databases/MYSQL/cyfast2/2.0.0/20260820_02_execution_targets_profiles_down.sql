-- Explicit rollback for managed execution targets and profiles.
-- Run only after retention approval and target/profile export.

DROP TABLE IF EXISTS execution_target_health_events;
DROP TABLE IF EXISTS execution_targets;
DROP TABLE IF EXISTS execution_profiles;
