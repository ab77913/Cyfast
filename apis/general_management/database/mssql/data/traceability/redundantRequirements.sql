SELECT 
    COUNT(RD.RequirementDesc) as TotalCount
FROM
    (SELECT 
        RequirementDesc, count(RequirementDesc) as RedundantCount
    FROM
        Requirement
    WHERE
        ProjectId = @projectId
    GROUP BY 
        RequirementDesc
    HAVING 
        COUNT(RequirementDesc) > 1) RD