SELECT TOP 10
	TC.TestCaseName,
	TC.TestCaseNo,
	TC.TestCaseId,
	TCE.TotalCount,
	TCE.FailedCount,
	CASE 
		WHEN TCE.TotalCount = 0
		THEN 0 ELSE (TCE.FailedCount * 100 / TCE.TotalCount)
	END as FailurePercentage
FROM
	TestCase TC
	INNER JOIN
	(
	SELECT 
		TestCaseId,
		count(*) as TotalCount,
		sum(
			CASE 
				WHEN Status = 'FAILED'
				THEN 1 ELSE 0
			END) as FailedCount
	FROM 
		TestCaseExecution
	WHERE ProjectId = @projectId
	GROUP BY
		TestCaseId
	) TCE ON TC.TestCaseId = TCE.TestCaseId
WHERE TC.ProjectId = @projectId
ORDER BY FailurePercentage DESC
