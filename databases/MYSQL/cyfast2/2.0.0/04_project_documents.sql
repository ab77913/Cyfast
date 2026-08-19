-- Migration: project_document table
-- Introduces project_document for the Gen AI V&V "Document Ingestion" layer.
-- Raw bytes live in the storage_service (referenced via storage_file_id / storage_file_url).
-- Parsed hierarchical chunks (PageIndex tree) live in MongoDB collection
-- `project_document_chunks` and are linked back via project_document_id.
USE cyfast3;

CREATE TABLE IF NOT EXISTS project_document (
    project_document_id BIGINT AUTO_INCREMENT NOT NULL,
    organization_id INT NOT NULL,
    project_id INT NOT NULL,

    doc_type VARCHAR(50) NOT NULL,                 -- BRD / SRS / FRS / REGULATORY / SAFETY_REQUIREMENTS /
                                                   -- EXPORTED_REQUIREMENTS / EXPORTED_TEST_CASES / DESIGN / OTHER
    title VARCHAR(255) NULL,
    version VARCHAR(50) NULL,
    description TEXT NULL,
    author VARCHAR(150) NULL,
    language VARCHAR(20) NULL,                     -- ISO 639-1 (en, de, ja, ...)
    source VARCHAR(20) DEFAULT 'UPLOAD' NOT NULL,  -- UPLOAD / ALM / URL

    storage_file_id VARCHAR(100) NULL,             -- UUID returned by storage_service
    storage_file_url VARCHAR(500) NULL,            -- absolute URL to the blob in storage_service
    original_filename VARCHAR(255) NULL,
    stored_filename VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,                         -- bytes

    status VARCHAR(20) DEFAULT 'UPLOADED' NOT NULL, -- UPLOADED / PARSING / PARSED / INDEXED / FAILED
    parse_status_detail TEXT NULL,                  -- error messages / parser notes
    chunk_count INT DEFAULT 0 NULL,                 -- number of leaf chunks produced
    page_count INT NULL,                            -- if applicable (PDF)

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
