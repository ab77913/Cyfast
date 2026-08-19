SELECT
	COUNT(Rsk.RiskId) as TotalCount,
	SUM(
		CASE 
			WHEN Rsk.MappedCount > 0
			THEN 1 ELSE 0
		END) as TracedCount
FROM
	(
	SELECT R.RiskId, COUNT(RR.RequirementId) as MappedCount
	FROM
		Risk R
		LEFT JOIN
		RiskRequirement RR
			ON R.RiskId = RR.RiskId AND R.RiskVersion = RR.RiskVersion
	WHERE 
		R.ProjectId = @projectId
	GROUP BY
		R.RiskId
	) Rsk