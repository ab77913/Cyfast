SELECT 
    *
FROM 
    test_script
WHERE
    project_id = @projectId AND name = @testScriptName;
