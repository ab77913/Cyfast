SELECT
    *
FROM 
    OrchestrationExecution
WHERE
    OrchestrationExecutionId = (
        SELECT TOP 1
            OrchestrationExecutionId
        FROM
            OrchestrationExecution
        WHERE
            OrchestrationId = @orchestrationId
        ORDER BY
            OrchestrationExecutionId DESC
    )