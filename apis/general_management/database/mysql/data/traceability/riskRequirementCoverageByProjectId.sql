SELECT 
	R.risk_id as risk_id,
	SUM(CASE WHEN TER.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
	SUM(CASE WHEN TER.status = 'PASSED' THEN 1 ELSE 0 END) AS passed_count,
	SUM(CASE WHEN TER.status = 'ERROR' THEN 1 ELSE 0 END) AS error_count,
	SUM(CASE WHEN TER.status = 'NOT_EXECUTED' THEN 1 ELSE 0 END) AS not_executed_count,
	SUM(CASE WHEN T.test_case_no IS NOT NULL THEN 1 ELSE 0 END) AS mapped_count
FROM
    risk R 
    LEFT JOIN
    risk_requirement RR ON R.risk_id = RR.risk_id 
    LEFT JOIN 
    requirement Req ON RR.requirement_id = Req.requirement_id 
	LEFT JOIN 
	requirement_test_case RT ON Req.requirement_id = RT.requirement_id 
	LEFT JOIN 
	test_case T ON RT.test_case_id = T.test_case_id  AND ((RT.test_case_version IS NULL AND T.version IS NULL) OR RT.test_case_version = T.version)
	LEFT JOIN
	(
		SELECT TE.* 
		FROM 
			test_case_execution TE
			INNER JOIN 
			(
				SELECT MAX(end_time) as latest_end_time, test_case_id, MAX (test_case_execution_id) as max_test_case_execution_id 
				FROM test_case_execution 
				WHERE project_id = ?
				GROUP BY test_case_id
			) LTE 
		ON 
			TE.test_case_id = LTE.test_case_id AND 
			(
				(LTE.latest_end_time IS NOT NULL AND TE.end_time = LTE.latest_end_time) OR 
				(LTE.latest_end_time IS NULL AND TE.test_case_execution_id = LTE.max_test_case_execution_id)
			)
	) TER
	ON T.test_case_id = TER.test_case_id
	LEFT JOIN
	orchestration O ON TER.orchestration_id = O.orchestration_id
WHERE
	Req.project_id = ?
GROUP BY R.risk_id