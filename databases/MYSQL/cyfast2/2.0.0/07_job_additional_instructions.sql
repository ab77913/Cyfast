-- Optional extraction hints persisted on requirement-generation jobs.

ALTER TABLE job
    ADD COLUMN additional_instructions TEXT NULL
    AFTER source_document_ids;
