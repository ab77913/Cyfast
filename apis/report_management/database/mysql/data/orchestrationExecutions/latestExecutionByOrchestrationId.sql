SELECT
    *
FROM 
    orchestration_execution
WHERE
    orchestration_execution_id = (
        SELECT 
            orchestration_execution_id
        FROM
            orchestration_execution
        WHERE
            orchestration_id = :orchestrationId
        ORDER BY
            orchestration_execution_id DESC
        LIMIT 1
    );
