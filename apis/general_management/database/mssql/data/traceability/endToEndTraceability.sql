SELECT 
    R.RiskId as RiskId,
    R.RiskNo as RiskNo,
    R.RpnNumber as RpnNumber,
    R.RiskDesc as RiskDesc,
    Req.RequirementId as RequirementId,
    Req.RequirementNo as RequirementNo,
    Req.RequirementDesc as RequirementDesc,
    T.TestCaseId as TestCaseId,
    T.TestCaseNo as TestCaseNo,
    T.TestCaseDesc as TestCaseDesc
FROM
    Risk R 
    LEFT JOIN
    RiskRequirement RR ON R.RiskId = RR.RiskId AND R.RiskVersion = RR.RiskVersion
    LEFT JOIN 
    Requirement Req ON RR.RequirementId = Req.RequirementId AND RR.RequirementVersion = Req.RequirementVersion
    LEFT JOIN 
    RequirementTestCase RT ON Req.RequirementId = RT.RequirementId AND Req.RequirementVersion = RT.RequirementVersion
    LEFT JOIN 
    TestCase T ON RT.TestCaseId = T.TestCaseId  AND ((RT.TestCaseVersion IS NULL AND T.TestCaseVersion IS NULL) OR RT.TestCaseVersion = T.TestCaseVersion)
    LEFT JOIN
    (SELECT TE.* 
        FROM 
            TestCaseExecution TE
            INNER JOIN 
            (
            SELECT MAX(EndTime) as LatestEndTime, TestCaseId, MAX (TestCaseExecutionId) as MaxTestCaseExecutionId 
            FROM TestCaseExecution 
            WHERE ProjectId = @projectId
            GROUP BY TestCaseId
            ) LTE 
            ON 
                TE.TestCaseId = LTE.TestCaseId AND 
                (
                    (LTE.LatestEndTime IS NOT NULL AND TE.EndTime = LTE.LatestEndTime) OR 
                    (LTE.LatestEndTime IS NULL AND TE.TestCaseExecutionId = LTE.MaxTestCaseExecutionId)
                )
        ) CLTE
        ON T.TestCaseId = CLTE.TestCaseId
    LEFT JOIN
    Orchestration O ON CLTE.OrchestrationId = O.OrchestrationId
WHERE
    R.ProjectId = @projectId AND Req.ProjectId = @projectId