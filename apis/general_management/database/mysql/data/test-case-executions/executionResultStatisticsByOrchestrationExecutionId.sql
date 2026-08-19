SELECT 
    count(*) as total_count,
		sum(
			CASE 
				WHEN status = 'FAILED'
				THEN 1 ELSE 0
			END) as failed_count,
		sum(
			CASE 
				WHEN status = 'PASSED'
				THEN 1 ELSE 0
			END) as passed_count,
		sum(
			CASE 
				WHEN status = 'ERROR'
				THEN 1 ELSE 0
			END) as error_count,
		sum(
			CASE 
				WHEN status = 'NOT_EXECUTED'
				THEN 1 ELSE 0
			END) as not_executed_count,
		sum(
			CASE 
				WHEN status = 'PAUSED'
				THEN 1 ELSE 0
			END) as paused_count,
		sum(
			CASE 
				WHEN status = 'INPROGRESS'
				THEN 1 ELSE 0
			END) as in_progress_count 
FROM test_case_execution
WHERE orchestration_execution_id = ?