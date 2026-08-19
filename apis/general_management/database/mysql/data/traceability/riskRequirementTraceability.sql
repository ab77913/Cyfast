SELECT 
    R.risk_no AS risk_no,
    R.description AS risk_desc,
    Req.requirement_no AS requirement_no,
    Req.description AS requirement_desc
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
WHERE
    R.project_id = ? 
    AND Req.project_id = ?;
