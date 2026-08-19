SELECT 
    *
FROM 
    test_script
WHERE
    project_id = @projectId AND file_path = @testScriptFilePath;
