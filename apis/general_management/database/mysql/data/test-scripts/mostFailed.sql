-- TOP 10 to LIMIT 10

SELECT
    TS.name,
    TS.test_script_id,
    TSE.total_count,
    TSE.failed_count,
    CASE 
        WHEN TSE.total_count = 0
        THEN 0 
        ELSE (TSE.failed_count * 100 / TSE.total_count)
    END AS failure_percentage
FROM
    test_script TS
    INNER JOIN
    (
        SELECT 
            test_script_id,
            COUNT(*) AS total_count,
            SUM(
                CASE 
                    WHEN status = 'FAILED'
                    THEN 1 ELSE 0
                END) AS failed_count
        FROM 
            test_script_execution
        WHERE project_id = ?
        GROUP BY
            test_script_id
    ) TSE ON TS.test_script_id = TSE.test_script_id
WHERE TS.project_id = ?
ORDER BY failure_percentage DESC
LIMIT 10;
