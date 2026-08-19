SELECT 
    TC.TestCaseNo,
    TC.TestCaseName,
    TC.TestCaseDesc,
    TC.Tag,
    TE.Status,
    TE.StartTime,
    TE.EndTime,
    TE.TestEnvironmentId
FROM 
    TestCaseExecution TE
    INNER JOIN 
    TestCase TC ON TE.TestCaseId = TC.TestCaseId
    INNER JOIN    
    (SELECT 
        MAX(Endtime) as LatestEndTime, TestCaseId, MAX (TestCaseExecutionId) as MaxTestCaseExecutionId 
    FROM TestCaseExecution 
    WHERE OrchestrationId = @orchestrationId 
    GROUP BY TestCaseId) LTE 
    ON 
        TE.TestCaseId = LTE.TestCaseId 
        AND (
            (LTE.LatestEndTime IS NOT NULL AND TE.EndTime = LTE.LatestEndTime) 
            OR 
            (LTE.LatestEndTime IS NULL AND TE.TestCaseExecutionId = LTE.MaxTestCaseExecutionId)
        )
WHERE TE.OrchestrationId = @orchestrationId