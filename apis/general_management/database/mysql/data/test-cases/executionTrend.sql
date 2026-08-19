SELECT
    DATE_FORMAT(OE.end_time, '%b-%d-%Y') AS date,
    COUNT(*) AS total_count,
    SUM(
        CASE 
            WHEN TE.status = 'FAILED'
            THEN 1 ELSE 0
        END) AS failed_count,
    SUM(
        CASE 
            WHEN TE.status = 'PASSED'
            THEN 1 ELSE 0
        END) AS passed_count,
    SUM(
        CASE 
            WHEN TE.status = 'ERROR'
            THEN 1 ELSE 0
        END) AS error_count,
    SUM(
        CASE 
            WHEN TE.status = 'NOTEXECUTED'
            THEN 1 ELSE 0
        END) AS not_executed_count
FROM
    orchestration_execution AS OE
    INNER JOIN 
    (
        SELECT 
            orchestration_id,
            MAX(end_time) AS lastest_end_time,
            MAX(orchestration_execution_id) AS max_orchestration_execution_id 
        FROM 
            orchestration_execution 
        WHERE orchestration_id = ? 
        GROUP BY orchestration_id, DATE(end_time)
    ) LOE
    ON 
        LOE.orchestration_id = OE.orchestration_id 
        AND (
            (LOE.lastest_end_time IS NOT NULL AND OE.end_time = LOE.lastest_end_time) 
            OR 
            (LOE.lastest_end_time IS NULL AND OE.orchestration_execution_id = LOE.max_orchestration_execution_id)
        )
    INNER JOIN 
    test_case_execution AS TE
    ON OE.orchestration_execution_id = TE.orchestration_execution_id
WHERE 
    TE.orchestration_id = ?
    AND (? IS NULL OR (OE.end_time > ?))
GROUP BY 
    OE.orchestration_execution_id, OE.end_time
ORDER BY
    OE.end_time DESC;
