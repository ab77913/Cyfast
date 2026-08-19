SELECT 
    O.OrchestrationName,
    TC.TestCaseNo,
    TC.TestCaseName,
    TC.TestCaseDesc,
    TC.Tags,
    TE.Status,
    TE.StartTime,
    TE.EndTime,
    TE.TestEnvironmentId
FROM 
    Orchestration O
    INNER JOIN
    TestCaseExecution TE ON O.OrchestrationId = TE.OrchestrationId
    INNER JOIN 
    TestCase TC ON TE.TestCaseId = TC.TestCaseId
    INNER JOIN    
    (SELECT 
        MAX(Endtime) as LatestEndTime, TestCaseId, MAX (TestCaseExecutionId) as MaxTestCaseExecutionId 
    FROM TestCaseExecution 
    WHERE ProjectId = @projectId 
    GROUP BY TestCaseId) LTE 
    ON 
        TE.TestCaseId = LTE.TestCaseId 
        AND (
            (LTE.LatestEndTime IS NOT NULL AND TE.EndTime = LTE.LatestEndTime) 
            OR 
            (LTE.LatestEndTime IS NULL AND TE.TestCaseExecutionId = LTE.MaxTestCaseExecutionId)
        )
WHERE TE.ProjectId = @projectId