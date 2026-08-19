-- Replaces deprecated header_notification (rename migration for existing DBs)
DROP TABLE IF EXISTS header_notification;

-- Incremental install / legacy DBs
CREATE TABLE IF NOT EXISTS user_notification (
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
