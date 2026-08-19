SELECT
    OE.*,
    LOE.LatestExecutionId,
    GTE.TestCaseNos,
    GTE.TestEnvironmentIds
    FROM 
        OrchestrationExecution as OE
        INNER JOIN 
        (
            SELECT 
                OrchestrationId,
                MAX(OrchestrationExecutionId) as LatestExecutionId
            FROM
                OrchestrationExecution
            WHERE
                ProjectId = @projectId
            GROUP BY OrchestrationId
        ) LOE ON OE.OrchestrationExecutionId = LOE.LatestExecutionId
        LEFT JOIN
        (
            SELECT OrchestrationExecutionId, string_agg(TestCaseNo, ', ') as TestCaseNos, string_agg(TestEnvironmentId, ', ') as TestEnvironmentIds
            FROM TestCaseExecution 
            WHERE ProjectId = @projectId
            GROUP BY OrchestrationExecutionId
        ) GTE ON LOE.LatestExecutionId = GTE.OrchestrationExecutionId
    WHERE
        OE.ProjectId = @projectId