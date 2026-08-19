SELECT 
    R.risk_no AS risk_no,
    R.description AS risk_desc,
    Req.requirement_no AS requirement_no,
    Req.description AS requirement_desc,
    T.test_case_no AS test_case_no,
    T.name AS test_case_name,
    TER.status AS Result,
    TER.start_time AS start_time,
    TER.end_time AS end_time,
    TER.elapsed_time AS elapsed_time
FROM
    risk R 
    LEFT JOIN
    risk_requirement RR 
        ON R.risk_id = RR.risk_id 
        AND ((RR.risk_version IS NULL OR R.version IS NULL) 
        OR R.version = RR.risk_version)
    LEFT JOIN 
    requirement Req 
        ON RR.requirement_id = Req.requirement_id 
        AND ((RR.requirement_version IS NULL OR Req.version IS NULL) 
        OR RR.requirement_version = Req.version)
    LEFT JOIN 
    requirement_test_case RT 
        ON Req.requirement_id = RT.requirement_id 
        AND ((RT.requirement_version IS NULL OR Req.version IS NULL) 
        OR Req.version = RT.requirement_version)
    LEFT JOIN 
    test_case T 
        ON RT.test_case_id = T.test_case_id  
        AND ((RT.test_case_version IS NULL AND T.version IS NULL) 
        OR RT.test_case_version = T.version)
    LEFT JOIN
    (SELECT 
        TE.*
    FROM
        test_case_execution AS TE
        INNER JOIN 
        (SELECT 
            test_case_id,
            MAX(end_time) AS lastest_end_time, 
            MAX(test_case_execution_id) AS max_test_case_execution_id 
        FROM test_case_execution 
        WHERE project_id = ?
        GROUP BY test_case_id
        ) LTE 
        ON 
            TE.project_id = ?
            AND TE.test_case_id = LTE.test_case_id 
            AND (
                (LTE.lastest_end_time IS NOT NULL AND TE.end_time = LTE.lastest_end_time) 
                OR 
                (LTE.lastest_end_time IS NULL AND TE.test_case_execution_id = LTE.max_test_case_execution_id)
            )
    ) TER
    ON T.test_case_id = TER.test_case_id 
    AND TER.project_id = ?
WHERE
    R.project_id = ? 
    AND Req.project_id = ?;
