SELECT
	COUNT(Req.RequirementId) as TotalCount,
	SUM(
		CASE 
			WHEN MappedCount > 0
			THEN 1 ELSE 0
		END) as TracedCount
FROM
	(
	SELECT R.RequirementId, COUNT(RT.TestCaseId) as MappedCount
	FROM
		Requirement R
		LEFT JOIN
		RequirementTestCase RT
			ON R.RequirementId = RT.RequirementId AND R.RequirementVersion = RT.RequirementVersion
	WHERE 
		R.ProjectId = @projectId
	GROUP BY
		R.RequirementId
	) Req