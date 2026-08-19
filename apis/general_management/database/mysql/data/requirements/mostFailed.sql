SELECT 
    REQ.description,
    REQ.requirement_no,
    REQ.requirement_id,
    RE.total_count,
    RE.failed_count,
    CASE 
        WHEN RE.total_count = 0
        THEN 0 
        ELSE (RE.failed_count * 100 / RE.total_count)
    END AS failure_percentage
FROM
    requirement REQ
    INNER JOIN
    (
        SELECT 
            R.requirement_id, 
            COUNT(*) AS total_count,
            SUM(
                CASE 
                    WHEN status = 'FAILED'
                    THEN 1 
                    ELSE 0
                END) AS failed_count
        FROM 
            requirement R
            INNER JOIN requirement_test_case RTC ON R.requirement_id = RTC.requirement_id
            INNER JOIN test_case_execution TCE ON RTC.test_case_id = TCE.test_case_id    
        WHERE 
            R.project_id = ?
        GROUP BY
            R.requirement_id
    ) RE ON REQ.requirement_id = RE.requirement_id
WHERE 
    REQ.project_id = ?
ORDER BY 
    failure_percentage DESC
LIMIT 10;

