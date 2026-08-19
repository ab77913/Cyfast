-- Migrate existing installs that still use `requirement_generation_job`.
-- Backup first. Skip if database was created from current 01_schema.sql (already has `job`).

-- Drop FK so parent table can be renamed
ALTER TABLE generated_requirement DROP FOREIGN KEY fk_genreq_job;

-- Add discriminator column (ignored if column already exists — run manually if duplicate)
ALTER TABLE requirement_generation_job
    ADD COLUMN job_type VARCHAR(48) NOT NULL DEFAULT 'REQUIREMENT_GENERATION' AFTER organization_id;

RENAME TABLE requirement_generation_job TO job;

ALTER TABLE generated_requirement
    ADD CONSTRAINT fk_genreq_job FOREIGN KEY (job_id) REFERENCES job (job_id)
        ON DELETE CASCADE;

-- Optional: align index name with fresh schema (ignore error if idx_reqgenjob_project does not exist)
-- DROP INDEX idx_reqgenjob_project ON job;
-- CREATE INDEX idx_job_project_type ON job (project_id, job_type, status);
