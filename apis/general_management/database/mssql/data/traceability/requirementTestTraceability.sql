SELECT 
    R.RequirementNo as RequirementNo,
    R.RequirementDesc as RequirementDesc,
    T.TestCaseNo as TestCaseNo,
    T.TestCaseName as TestCaseName,
	TER.Status as Result,
	TER.StartTime as StartTime,
	TER.EndTime as EndTime,
    TER.ElapsedTime as ElapsedTime
FROM
    Requirement R 
    LEFT JOIN
    RequirementTestCase RT ON R.RequirementId = RT.RequirementId AND R.RequirementVersion = RT.RequirementVersion
    LEFT JOIN 
    TestCase T ON RT.TestCaseId = T.TestCaseId  AND ((RT.TestCaseVersion IS NULL AND T.TestCaseVersion IS NULL) OR RT.TestCaseVersion = T.TestCaseVersion)
    LEFT JOIN
	(SELECT 
		TE.*
	FROM
		TestCaseExecution as TE
		INNER JOIN 
		(SELECT 
				TestCaseId,
				MAX(EndTime) as LatestEndTime, 
				MAX (TestCaseExecutionId) as MaxTestCaseExecutionId 
			FROM TestCaseExecution 
			WHERE ProjectId = @projectId
			GROUP BY TestCaseId
		) LTE 
		ON 
			TE.ProjectId = @projectId
			AND TE.TestCaseId = LTE.TestCaseId 
			AND (
				(LTE.LatestEndTime IS NOT NULL AND TE.EndTime = LTE.LatestEndTime) 
				OR 
				(LTE.LatestEndTime IS NULL AND TE.TestCaseExecutionId = LTE.MaxTestCaseExecutionId)
			)
	) TER
	ON T.TestCaseId = TER.TestCaseId AND TER.ProjectId = @projectId
WHERE
    R.ProjectId = @projectId AND T.ProjectId = @projectId