SELECT 
    R.risk_id AS risk_id,
    R.risk_no AS risk_no,
    R.rpn_number AS rpn_number,
    R.description AS risk_desc,
    Req.requirement_id AS requirement_id,
    Req.requirement_no AS requirement_no,
    Req.description AS requirement_desc,
    T.test_case_id AS test_case_id,
    T.test_case_no AS test_case_no,
    T.description AS test_case_desc
FROM
    risk R 
    LEFT JOIN
    risk_requirement RR ON R.risk_id = RR.risk_id AND R.version = RR.risk_version
    LEFT JOIN 
    requirement Req ON RR.requirement_id = Req.requirement_id AND RR.requirement_version = Req.version
    LEFT JOIN 
    requirement_test_case RT ON Req.requirement_id = RT.requirement_id AND Req.version = RT.requirement_version
    LEFT JOIN 
    test_case T ON RT.test_case_id = T.test_case_id AND ((RT.test_case_version IS NULL AND T.version IS NULL) OR RT.test_case_version = T.version)
    LEFT JOIN
    (SELECT TE.* 
        FROM 
            test_case_execution TE
            INNER JOIN 
            (
            SELECT MAX(end_time) AS lastest_end_time, test_case_id, MAX(test_case_execution_id) AS max_test_case_execution_id 
            FROM test_case_execution 
            WHERE project_id = @projectId
            GROUP BY test_case_id
            ) LTE 
            ON 
                TE.test_case_id = LTE.test_case_id AND 
                (
                    (LTE.lastest_end_time IS NOT NULL AND TE.end_time = LTE.lastest_end_time) OR 
                    (LTE.lastest_end_time IS NULL AND TE.test_case_execution_id = LTE.max_test_case_execution_id)
                )
    ) CLTE ON T.test_case_id = CLTE.test_case_id
    LEFT JOIN
    orchestration O ON CLTE.orchestration_id = O.orchestration_id
WHERE
    R.project_id = @projectId AND Req.project_id = @projectId;
