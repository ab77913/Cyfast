SELECT 
	Req.RequirementId as RequirementId,
	SUM(CASE WHEN TER.Status = 'FAILED' THEN 1 ELSE 0 END) AS FailedCount,
	SUM(CASE WHEN TER.Status = 'PASSED' THEN 1 ELSE 0 END) AS PassedCount,
	SUM(CASE WHEN TER.Status = 'ERROR' THEN 1 ELSE 0 END) AS ErrorCount,
	SUM(CASE WHEN TER.Status = 'NOT EXECUTED' THEN 1 ELSE 0 END) AS NotExecutedCount,
	SUM(CASE WHEN T.TestCaseNo IS NOT NULL THEN 1 ELSE 0 END) AS MappedCount
FROM
	Requirement Req 
	LEFT JOIN 
	RequirementTestCase RT ON Req.RequirementId = RT.RequirementId AND Req.RequirementVersion = RT.RequirementVersion
	LEFT JOIN 
	TestCase T ON RT.TestCaseId = T.TestCaseId  AND ((RT.TestCaseVersion IS NULL AND T.TestCaseVersion IS NULL) OR RT.TestCaseVersion = T.TestCaseVersion)
	LEFT JOIN
	(
		SELECT TE.* 
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
	) TER
	ON T.TestCaseId = TER.TestCaseId
	LEFT JOIN
	Orchestration O ON TER.OrchestrationId = O.OrchestrationId
WHERE
	Req.ProjectId = @projectId
GROUP BY Req.RequirementId