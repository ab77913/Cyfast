SELECT TOP 10
	TC.TestScriptName,
	TC.TestScriptId,
	TCE.TotalCount,
	TCE.FailedCount,
	CASE 
		WHEN TCE.TotalCount = 0
		THEN 0 ELSE (TCE.FailedCount * 100 / TCE.TotalCount)
	END as FailurePercentage
FROM
	TestScript TC
	INNER JOIN
	(
	SELECT 
		TestScriptId,
		count(*) as TotalCount,
		sum(
			CASE 
				WHEN Status = 'FAILED'
				THEN 1 ELSE 0
			END) as FailedCount
	FROM 
		TestScriptExecution
	WHERE ProjectId = @projectId
	GROUP BY
		TestScriptId
	) TCE ON TC.TestScriptId = TCE.TestScriptId
WHERE TC.ProjectId = @projectId
ORDER BY FailurePercentage DESC
