SELECT 
    count(*) as TotalCount,
		sum(
			CASE 
				WHEN Status = 'FAILED'
				THEN 1 ELSE 0
			END) as FailedCount,
		sum(
			CASE 
				WHEN Status = 'PASSED'
				THEN 1 ELSE 0
			END) as PassedCount,
		sum(
			CASE 
				WHEN Status = 'ERROR'
				THEN 1 ELSE 0
			END) as ErrorCount,
		sum(
			CASE 
				WHEN Status = 'NOT_EXECUTED'
				THEN 1 ELSE 0
			END) as NotExecutedCount,
		sum(
			CASE 
				WHEN Status = 'PAUSED'
				THEN 1 ELSE 0
			END) as PausedCount,
		sum(
			CASE 
				WHEN Status = 'INPROGRESS'
				THEN 1 ELSE 0
			END) as InProgressCount 
FROM [dbo].[TestCaseExecution]
WHERE [OrchestrationExecutionId]=@orchestrationExecutionId