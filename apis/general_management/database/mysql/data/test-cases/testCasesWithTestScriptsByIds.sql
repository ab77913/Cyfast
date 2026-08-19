-- Replace STRING_AGG with GROUP_CONCAT & Replace STRING_SPLIT with FIND_IN_SET

SELECT 
    TC.*,
    TS.name as test_script_name,
    TS.file_path,
    TS.file_name,
    RRT.requirement_nos
FROM 
    test_case TC
    LEFT JOIN 
    test_script TS ON TC.test_script_id = TS.test_script_id
    LEFT JOIN
    (
        SELECT 
            RT.test_case_id,
            RT.test_case_version,
            GROUP_CONCAT(R.requirement_no SEPARATOR ',') AS requirement_nos
        FROM
            requirement_test_case RT
            INNER JOIN
            requirement R ON RT.requirement_id = R.requirement_id AND RT.requirement_version = R.version
        GROUP BY RT.test_case_id, RT.test_case_version
    ) RRT ON TC.test_case_id = RRT.test_case_id AND (TC.version IS NULL OR TC.version = RRT.test_case_version)
WHERE
    TC.test_case_id IN (?);
