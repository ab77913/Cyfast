
SELECT 
    *
FROM project
WHERE project_id = @projectId
  AND deleted_at IS NULL;
