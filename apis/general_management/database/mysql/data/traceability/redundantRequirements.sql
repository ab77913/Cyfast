SELECT 
    COUNT(RD.description) AS total_count
FROM
    (SELECT 
        description, COUNT(description) AS RedundantCount
    FROM
        requirement
    WHERE
        project_id = @projectId
    GROUP BY 
        description
    HAVING 
        COUNT(description) > 1) RD;
