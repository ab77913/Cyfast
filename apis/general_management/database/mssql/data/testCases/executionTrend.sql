SELECT
		FORMAT(CAST(OE.EndTime as date), 'MMM-dd-yyy')AS Date,
		count(*) as  TotalCount,
		sum(
			CASE 
				WHEN TE.Status = 'FAILED'
				THEN 1 ELSE 0
			END) as FailedCount,
		sum(
			CASE 
				WHEN TE.Status = 'PASSED'
				THEN 1 ELSE 0
			END) as PassedCount,
		sum(
			CASE 
				WHEN TE.Status = 'ERROR'
				THEN 1 ELSE 0
			END) as ErrorCount,
		sum(
			CASE 
				WHEN TE.Status = 'NOTEXECUTED'
				THEN 1 ELSE 0
			END) as NotExecutedCount
	FROM
		[OrchestrationExecution] as OE
		INNER JOIN 
		(
			SELECT 
				OrchestrationId,
				MAX(EndTime) as LatestEndTime,
				MAX (OrchestrationExecutionId) as MaxOrchestrationExecutionId 
			FROM 
				[OrchestrationExecution] 
			WHERE OrchestrationId = @orchestrationId 
				GROUP BY OrchestrationId, CAST(EndTime as DATE)
		) LOE
		ON 
			LOE.OrchestrationId = OE.OrchestrationId 
			AND (
				(LOE.LatestEndTime IS NOT NULL AND OE.EndTime = LOE.LatestEndTime) 
				OR 
				(LOE.LatestEndTime IS NULL AND OE.OrchestrationExecutionId = LOE.MaxOrchestrationExecutionId)
			)
		INNER JOIN 
		[TestCaseExecution] as TE
		ON OE.OrchestrationExecutionId = TE.OrchestrationExecutionId
	WHERE 
		TE.OrchestrationId = @orchestrationId
		AND (@fromDate IS NULL OR (@fromDate IS NOT NULL AND OE.EndTime > @fromDate))
	GROUP BY 
		OE.OrchestrationExecutionId, OE.EndTime
	ORDER BY
		OE.EndTime DESC