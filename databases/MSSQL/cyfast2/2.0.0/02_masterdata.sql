
USE cyfast3;
GO

/**** Insert default organization ****/
INSERT INTO organization (organization_id, name, domain, client_id, client_secret, created_by, created_date, modified_by, modified_date, deleted_by, deleted_date)
VALUES (1, 'Cyient', 'Services', NULL, NULL, 'admin', '2023-02-07 10:50:13', 'admin', '2023-02-07 10:50:13', NULL, NULL);
GO

/**** Insert default roles ****/
SET IDENTITY_INSERT role ON;
GO

INSERT INTO role (role_id, organization_id, name, description, parent_role_id, created_by, created_date, modified_by, modified_date, deleted_by, deleted_date)
VALUES (1, 1, 'Super Admin', NULL, NULL, 'admin', '2023-02-07 10:50:13', 'admin', '2023-02-07 10:50:13', NULL, NULL),
       (2, 1, 'Project Admin', NULL, NULL, 'admin', '2023-02-07 10:50:13', 'admin', '2023-02-07 10:50:13', NULL, NULL),
       (3, 1, 'Project Manager', NULL, NULL, 'admin', '2023-02-07 10:50:13', 'admin', '2023-02-07 10:50:13', NULL, NULL),
       (4, 1, 'Test Architect', NULL, NULL, 'admin', '2023-02-07 10:50:13', 'admin', '2023-02-07 10:50:13', NULL, NULL),
       (5, 1, 'Test Engineer', NULL, NULL, 'admin', '2023-02-07 10:50:13', 'admin', '2023-02-07 10:50:13', NULL, NULL);
GO

SET IDENTITY_INSERT role OFF;
GO

/**** Insert default users ****/
SET IDENTITY_INSERT [user] ON;
GO

INSERT INTO [user] (user_id, organization_id, username, email, password_hash, phone_no, first_name, last_name, access_token, refresh_token, created_by, created_date, modified_by, modified_date, deleted_by, deleted_date)
VALUES (1, 1, 'admin@cyient.com', 'admin@cyient.com', '$2a$10$QgDR.Grs8cujNcwUGh1Bm.1kMlzCHNnEEGHpVCYCUJwPBlDsjHlg6', NULL, 'Admin', 'User', NULL, NULL, 'admin', '2023-02-07 10:50:13', 'admin', '2023-02-07 10:50:13', NULL, NULL);
GO

SET IDENTITY_INSERT [user] OFF;
GO

/**** Assign Default user Admin Role ****/
INSERT INTO user_role (organization_id, user_id, role_id, created_by, created_date, modified_by, modified_date, deleted_by, deleted_date)
VALUES (1, 1, 1, 'admin', '2023-02-07 10:50:13', 'admin', '2023-02-07 10:50:13', NULL, NULL);
GO
