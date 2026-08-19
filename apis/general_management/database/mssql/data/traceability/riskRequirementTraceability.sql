SELECT 
    R.RiskNo as RiskNo,
    R.RiskDesc as RiskDesc,
    Req.RequirementNo as RequirementNo,
    Req.RequirementDesc as RequirementDesc
FROM
    Risk R 
    LEFT JOIN
    RiskRequirement RR ON R.RiskId = RR.RiskId AND R.RiskVersion = RR.RiskVersion
    LEFT JOIN 
    Requirement Req ON RR.RequirementId = Req.RequirementId AND RR.RequirementVersion = Req.RequirementVersion
WHERE
    R.ProjectId = @projectId AND Req.ProjectId = @projectId