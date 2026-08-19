SELECT
    COUNT(Req.requirement_id) AS total_count,
    SUM(
        CASE 
            WHEN mapped_count > 0
            THEN 1 ELSE 0
        END
    ) AS TracedCount
FROM
    (
    SELECT R.requirement_id, COUNT(RT.test_case_id) AS mapped_count
    FROM
        requirement R
        LEFT JOIN
        requirement_test_case RT
            ON R.requirement_id = RT.requirement_id AND R.version = RT.requirement_version
    WHERE 
        R.project_id = @projectId
    GROUP BY
        R.requirement_id
    ) Req;
