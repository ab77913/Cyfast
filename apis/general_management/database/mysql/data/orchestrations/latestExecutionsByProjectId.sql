SELECT
    OE.*,
    o.name as orchestration_name,
    LOE.latest_execution_id,
    GTE.test_case_nos
FROM 
    orchestration as o
    INNER JOIN
    orchestration_execution AS OE ON OE.orchestration_id = o.orchestration_id
    INNER JOIN 
    (
        SELECT 
            orchestration_id,
            MAX(orchestration_execution_id) AS latest_execution_id
        FROM
            orchestration_execution
        WHERE
            project_id = ? AND end_time IS NOT NULL
        GROUP BY orchestration_id
    ) AS LOE ON OE.orchestration_execution_id = LOE.latest_execution_id
    LEFT JOIN
    (
        SELECT 
            orchestration_execution_id, 
            GROUP_CONCAT(test_case_no ORDER BY test_case_no ASC SEPARATOR ', ') AS test_case_nos
        FROM 
            test_case_execution 
        WHERE 
            project_id = ?
        GROUP BY 
            orchestration_execution_id
    ) AS GTE ON LOE.latest_execution_id = GTE.orchestration_execution_id
WHERE
    OE.project_id = ?;
