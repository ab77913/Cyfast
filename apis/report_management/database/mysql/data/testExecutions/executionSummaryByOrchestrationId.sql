SELECT 
    TC.test_case_no,
    TC.name,
    TC.description,
    TC.tags,
    TE.status,
    TE.start_time,
    TE.end_time
FROM 
    test_case_execution TE
    INNER JOIN 
    test_case TC ON TE.test_case_id = TC.test_case_id
    INNER JOIN    
    (SELECT 
        MAX(end_time) as lastest_end_time, test_case_id, MAX(test_case_execution_id) as MaxTestCaseExecutionId 
    FROM test_case_execution 
    WHERE orchestration_id = :orchestrationId 
    GROUP BY test_case_id) LTE 
    ON 
        TE.test_case_id = LTE.test_case_id 
        AND (
            (LTE.lastest_end_time IS NOT NULL AND TE.end_time = LTE.lastest_end_time) 
            OR 
            (LTE.lastest_end_time IS NULL AND TE.test_case_execution_id = LTE.MaxTestCaseExecutionId)
        )
WHERE TE.orchestration_id = :orchestrationId;
