-- SUM function with a CASE expression counts how many mapped_count values are greater than 0

SELECT
    COUNT(Rsk.risk_id) AS total_count,
    SUM(
        CASE 
            WHEN Rsk.mapped_count > 0
            THEN 1 ELSE 0
        END
    ) AS TracedCount
FROM
    (
    SELECT R.risk_id, COUNT(RR.requirement_id) AS mapped_count
    FROM
        risk R
        LEFT JOIN
        risk_requirement RR
            ON R.risk_id = RR.risk_id AND R.version = RR.risk_version
    WHERE 
        R.project_id = @projectId
    GROUP BY
        R.risk_id
    ) Rsk;
