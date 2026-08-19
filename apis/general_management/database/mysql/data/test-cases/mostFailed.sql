-- TOP 10 is used to limit the number of rows returned. In MySQL, this is achieved with the LIMIT 10 clause

SELECT
    TC.name,
    TC.test_case_no,
    TC.test_case_id,
    TCE.total_count,
    TCE.failed_count,
    CASE 
        WHEN TCE.total_count = 0
        THEN 0 
        ELSE (TCE.failed_count * 100 / TCE.total_count)
    END AS failure_percentage
FROM
    test_case TC
    INNER JOIN
    (
        SELECT 
            test_case_id,
            COUNT(*) AS total_count,
            SUM(
                CASE 
                    WHEN status = 'FAILED'
                    THEN 1 ELSE 0
                END) AS failed_count
        FROM 
            test_case_execution
        WHERE project_id = ?
        GROUP BY
            test_case_id
    ) TCE ON TC.test_case_id = TCE.test_case_id
WHERE TC.project_id = ?
ORDER BY failure_percentage DESC
LIMIT 10;
