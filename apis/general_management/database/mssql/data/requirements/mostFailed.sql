SELECT TOP 10
	REQ.RequirementDesc,
	REQ.RequirementNo,
	REQ.RequirementId,
	RE.TotalCount,
	RE.FailedCount,
	CASE 
		WHEN RE.TotalCount = 0
		THEN 0 ELSE (RE.FailedCount * 100 / RE.TotalCount)
	END as FailurePercentage
FROM
	Requirement REQ
	INNER JOIN
	(
	SELECT 
		R.RequirementId, 
		count(*) as TotalCount,
		sum(
			CASE 
				WHEN Status = 'FAILED'
				THEN 1 ELSE 0
			END) as FailedCount
	FROM 
		Requirement R
		INNER JOIN RequirementTestCase RTC ON R.RequirementId = RTC.RequirementId
		INNER JOIN TestCaseExecution TCE ON RTC.TestCaseId = TCE.TestCaseId	
	WHERE R.ProjectId = @projectId
	GROUP BY
		R.RequirementId
	) RE ON REQ.RequirementId = RE.RequirementId
WHERE REQ.ProjectId = @projectId
ORDER BY FailurePercentage DESC
