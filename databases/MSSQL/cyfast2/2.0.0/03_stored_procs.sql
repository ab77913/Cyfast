-- File: updated_procedures.sql
USE cyfast3;
GO

-- =============================================
-- Procedure: usp_get_execution_statistics
-- Description: Get execution stats for common dashboard
-- =============================================
IF OBJECT_ID('usp_get_execution_statistics', 'P') IS NOT NULL
    DROP PROCEDURE usp_get_execution_statistics;
GO

CREATE PROCEDURE usp_get_execution_statistics
    @organizationId INT
AS
BEGIN
    SELECT
        p.name,
        pt.*,
        req.requirements_count,
        req.requirements_mapped_count,
        req.requirements_failed_count
    FROM
        project AS p
        LEFT JOIN
        (SELECT
            tce.project_id AS project_id,
            MAX(itce.latest_end_time) AS last_execution_time,
            COUNT(*) AS total_count,
            SUM(CASE WHEN tce.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
            SUM(CASE WHEN tce.status = 'PASSED' THEN 1 ELSE 0 END) AS passed_count,
            SUM(CASE WHEN tce.status = 'ERROR' THEN 1 ELSE 0 END) AS error_count,
            SUM(CASE WHEN tce.status = 'NOT EXECUTED' THEN 1 ELSE 0 END) AS not_executed_count,
            SUM(CASE WHEN tce.status = 'PAUSED' THEN 1 ELSE 0 END) AS paused_count,
            SUM(CASE WHEN tce.status = 'INPROGRESS' THEN 1 ELSE 0 END) AS in_progress_count
        FROM 
            test_case_execution AS tce
            INNER JOIN 
            (SELECT project_id, MAX(end_time) AS latest_end_time, test_case_id, MAX(test_case_execution_id) AS max_test_case_execution_id
             FROM test_case_execution
             GROUP BY project_id, test_case_id) itce
            ON tce.project_id = itce.project_id 
            AND tce.test_case_id = itce.test_case_id 
            AND ((itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) 
            OR (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id))
        GROUP BY tce.project_id
        ) pt 
        ON p.project_id = pt.project_id 
        LEFT JOIN 
        (SELECT
            rd.project_id,
            COUNT(rd.requirement_id) AS requirements_count,
            SUM(CASE WHEN rd.requirements_mapped > 0 THEN 1 ELSE 0 END) AS requirements_mapped_count,
            SUM(CASE WHEN rd.requirements_failed > 0 THEN 1 ELSE 0 END) AS requirements_failed_count
        FROM 
            (SELECT 
                r.project_id,
                r.requirement_id,
                SUM(CASE WHEN rt.test_case_id IS NOT NULL THEN 1 ELSE 0 END) AS requirements_mapped,
                SUM(CASE WHEN otr.status = 'FAILED' THEN 1 ELSE 0 END) AS requirements_failed
            FROM 
                requirement AS r
                LEFT JOIN requirement_test_case AS rt
                ON r.requirement_id = rt.requirement_id 
                AND r.version = rt.requirement_version
                LEFT JOIN test_case AS t
                ON rt.test_case_id = t.test_case_id  
                LEFT JOIN 
                (SELECT tce.* 
                 FROM test_case_execution AS tce
                 INNER JOIN 
                     (SELECT test_case_id, MAX(end_time) AS latest_end_time, MAX(test_case_execution_id) AS max_test_case_execution_id
                      FROM test_case_execution 
                      GROUP BY project_id, test_case_id) itce
                 ON tce.test_case_id = itce.test_case_id 
                 AND ((itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) 
                 OR (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id))
                 ) otr
                ON t.test_case_id = otr.test_case_id
            GROUP BY r.project_id, r.requirement_id
            ) rd
        GROUP BY rd.project_id
        ) req 
        ON p.project_id = req.project_id
    ORDER BY pt.last_execution_time DESC;
END
GO

-- =============================================
-- Procedure: usp_get_project_backward_traceability
-- =============================================
IF OBJECT_ID('usp_get_project_backward_traceability', 'P') IS NOT NULL
    DROP PROCEDURE usp_get_project_backward_traceability;
GO

CREATE PROCEDURE usp_get_project_backward_traceability
    @projectId BIGINT
AS
BEGIN
    SELECT 
        tc.test_case_id,
        tc.test_case_no,
        tc.description,
        rq.project_id,
        o.orchestration_id,
        o.name,
        rq.requirement_id,
        rq.requirement_no,
        rq.description,
        rsk.risk_id,
        rsk.risk_no,
        rsk.description,
        rsk.rpn_number,
        ltce.status AS test_status,
        ltce.start_time,
        ltce.end_time,
        ltce.elapsed_time
    FROM
        test_case AS tc
        LEFT JOIN requirement_test_case AS rt
        ON tc.test_case_id = rt.test_case_id AND (rt.test_case_version IS NULL OR tc.version IS NULL OR rt.test_case_version = tc.version)
        LEFT JOIN requirement AS rq
        ON rq.requirement_id = rt.requirement_id AND rq.version = rt.requirement_version
        LEFT JOIN risk_requirement AS rr
        ON rq.requirement_id = rr.requirement_id AND rq.version = rr.requirement_version
        LEFT JOIN risk AS rsk
        ON rr.risk_id = rsk.risk_id AND rr.risk_version = rsk.version
        LEFT JOIN 
        (SELECT tce.* 
         FROM test_case_execution AS tce
         INNER JOIN 
             (SELECT MAX(end_time) AS latest_end_time, test_case_id, MAX(test_case_execution_id) AS max_test_case_execution_id 
              FROM test_case_execution 
              WHERE project_id = @projectId 
              GROUP BY test_case_id) itce
         ON tce.test_case_id = itce.test_case_id 
         AND ((itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) 
         OR (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id))
         ) ltce
        ON tc.test_case_id = ltce.test_case_id
        LEFT JOIN orchestration AS o
        ON ltce.orchestration_id = o.orchestration_id
    WHERE rq.project_id = @projectId 
    ORDER BY tc.test_case_id, rq.requirement_id ASC;
END
GO

-- =============================================
-- Procedure: usp_get_project_execution_duration
-- =============================================
IF OBJECT_ID('usp_get_project_execution_duration', 'P') IS NOT NULL
    DROP PROCEDURE usp_get_project_execution_duration;
GO

CREATE PROCEDURE usp_get_project_execution_duration
    @projectId INT
AS
BEGIN
    SELECT 
        ISNULL(SUM(CAST(oe.elapsed_time AS DECIMAL(10,2))), 0) AS total_elapsed_time
    FROM 
        orchestration_execution oe
    INNER JOIN 
        (
            SELECT 
                orchestration_id, 
                MAX(end_time) AS latest_end_time 
            FROM 
                orchestration_execution 
            WHERE 
                project_id = @projectId 
                AND elapsed_time IS NOT NULL 
            GROUP BY 
                orchestration_id
        ) ioe
    ON oe.project_id = @projectId 
    AND oe.orchestration_id = ioe.orchestration_id 
    AND oe.end_time = ioe.latest_end_time;
END
GO

-- =============================================
-- Procedure: usp_get_project_forward_traceability
-- =============================================
IF OBJECT_ID('usp_get_project_forward_traceability4', 'P') IS NOT NULL
    DROP PROCEDURE usp_get_project_forward_traceability4;
GO

CREATE PROCEDURE usp_get_project_forward_traceability4
    @projectId INT,
    @testCaseIds NVARCHAR(MAX)
AS
BEGIN
    SELECT 
        rq.project_id,
        o.orchestration_id,
        o.name as orchestration_name,
        rq.requirement_id,
        rq.requirement_no,
        rq.title as requirement_name,
        tc.test_case_id,
        tc.test_case_no,
        tc.name as test_case_name,
        rsk.risk_id,
        rsk.risk_no,
        rsk.title as risk_name,
        rsk.rpn_number,
        ltce.status AS test_status,
        ltce.start_time,
        ltce.end_time,
        ltce.elapsed_time
    FROM 
        requirement rq
    LEFT JOIN requirement_test_case rt 
        ON rq.requirement_id = rt.requirement_id AND (rt.requirement_version IS NULL OR rq.version = rt.requirement_version)
    LEFT JOIN test_case tc 
        ON rt.test_case_id = tc.test_case_id AND (rt.test_case_version IS NULL OR tc.version IS NULL OR rt.test_case_version = tc.version)
    LEFT JOIN risk_requirement rr 
        ON rq.requirement_id = rr.requirement_id AND (rr.requirement_version IS NULL OR rq.version IS NULL OR rq.version = rr.requirement_version)
    LEFT JOIN risk rsk 
        ON rr.risk_id = rsk.risk_id AND (rr.risk_version IS NULL OR rsk.version IS NULL OR rr.risk_version = rsk.version)
    LEFT JOIN 
        (
            SELECT tce.* 
            FROM test_case_execution tce
            INNER JOIN 
                (SELECT MAX(end_time) AS latest_end_time, test_case_id, MAX(test_case_execution_id) AS max_test_case_execution_id 
                 FROM test_case_execution 
                 WHERE project_id = @projectId 
                 GROUP BY test_case_id) itce
            ON tce.test_case_id = itce.test_case_id 
            AND ((itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) 
            OR (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id))
        ) ltce
    ON tc.test_case_id = ltce.test_case_id
    LEFT JOIN orchestration o
        ON ltce.orchestration_id = o.orchestration_id
    WHERE rq.project_id = @projectId
    ORDER BY rq.requirement_id, tc.test_case_id ASC;
END
GO

-- Stored Procedure 1
IF OBJECT_ID('usp_get_requirement_status_count', 'P') IS NOT NULL
    DROP PROCEDURE usp_get_requirement_status_count;
GO

CREATE PROCEDURE usp_get_requirement_status_count
    @projectId INT
AS
BEGIN
    SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN tce.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN tce.status = 'PASSED' THEN 1 ELSE 0 END) AS passed_count,
        SUM(CASE WHEN tce.status = 'ERROR' THEN 1 ELSE 0 END) AS error_count,
        SUM(CASE WHEN tce.status = 'NOT EXECUTED' THEN 1 ELSE 0 END) AS not_executed_count,
        SUM(CASE WHEN tce.status = 'PAUSED' THEN 1 ELSE 0 END) AS paused_count,
        SUM(CASE WHEN tce.status = 'INPROGRESS' THEN 1 ELSE 0 END) AS in_progress_count
    FROM 
        requirement_test_case rtc
    INNER JOIN 
        test_case_execution tce 
            ON rtc.test_case_id = tce.test_case_id
    INNER JOIN 
        (
            SELECT 
                MAX(end_time) AS latest_end_time, 
                test_case_id, 
                MAX(test_case_execution_id) AS max_test_case_execution_id 
            FROM 
                test_case_execution 
            WHERE 
                project_id = @projectId 
            GROUP BY 
                test_case_id
        ) itce 
            ON tce.test_case_id = itce.test_case_id 
            AND (
                (itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) OR 
                (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id)
            )
    WHERE 
        tce.project_id = @projectId;
END
GO

-- Stored Procedure 2
IF OBJECT_ID('usp_get_test_case_status_count', 'P') IS NOT NULL
    DROP PROCEDURE usp_get_test_case_status_count;
GO

CREATE PROCEDURE usp_get_test_case_status_count
    @projectId INT = NULL,
    @orchestrationId BIGINT = NULL
AS
BEGIN
    SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN tce.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN tce.status = 'PASSED' THEN 1 ELSE 0 END) AS passed_count,
        SUM(CASE WHEN tce.status = 'ERROR' THEN 1 ELSE 0 END) AS error_count,
        SUM(CASE WHEN tce.status = 'NOT EXECUTED' THEN 1 ELSE 0 END) AS not_executed_count,
        SUM(CASE WHEN tce.status = 'PAUSED' THEN 1 ELSE 0 END) AS paused_count,
        SUM(CASE WHEN tce.status = 'INPROGRESS' THEN 1 ELSE 0 END) AS in_progress_count
    FROM 
        test_case_execution tce
    INNER JOIN 
        (
            SELECT 
                MAX(end_time) AS latest_end_time, 
                test_case_id, 
                MAX(test_case_execution_id) AS max_test_case_execution_id 
            FROM 
                test_case_execution 
            WHERE 
                (@projectId IS NOT NULL AND project_id = @projectId) 
                OR (@orchestrationId IS NOT NULL AND orchestration_id = @orchestrationId)
            GROUP BY test_case_id
        ) itce 
            ON tce.test_case_id = itce.test_case_id 
            AND (
                (itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) 
                OR (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id)
            )
    WHERE 
        (@projectId IS NOT NULL AND tce.project_id = @projectId) 
        OR (@orchestrationId IS NOT NULL AND tce.orchestration_id = @orchestrationId);
END
GO

-- Stored Procedure 3
IF OBJECT_ID('usp_get_test_script_status_count', 'P') IS NOT NULL
    DROP PROCEDURE usp_get_test_script_status_count;
GO

CREATE PROCEDURE usp_get_test_script_status_count
    @projectId INT = NULL,
    @orchestrationId BIGINT = NULL
AS
BEGIN
    SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN tse.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN tse.status = 'PASSED' THEN 1 ELSE 0 END) AS passed_count,
        SUM(CASE WHEN tse.status = 'ERROR' THEN 1 ELSE 0 END) AS error_count,
        SUM(CASE WHEN tse.status = 'NOT EXECUTED' THEN 1 ELSE 0 END) AS not_executed_count,
        SUM(CASE WHEN tse.status = 'PAUSED' THEN 1 ELSE 0 END) AS paused_count,
        SUM(CASE WHEN tse.status = 'INPROGRESS' THEN 1 ELSE 0 END) AS in_progress_count
    FROM 
        test_script_execution tse
    INNER JOIN 
        (
            SELECT 
                MAX(end_time) AS latest_end_time, 
                test_script_id, 
                MAX(test_script_execution_id) AS max_test_script_execution_id 
            FROM 
                test_script_execution 
            WHERE 
                (@projectId IS NOT NULL AND project_id = @projectId) 
                OR (@orchestrationId IS NOT NULL AND orchestration_id = @orchestrationId)
            GROUP BY test_script_id
        ) itse 
            ON tse.test_script_id = itse.test_script_id 
            AND (
                (itse.latest_end_time IS NOT NULL AND tse.end_time = itse.latest_end_time) 
                OR (itse.latest_end_time IS NULL AND tse.test_script_execution_id = itse.max_test_script_execution_id)
            )
    WHERE 
        (@projectId IS NOT NULL AND tse.project_id = @projectId) 
        OR (@orchestrationId IS NOT NULL AND tse.orchestration_id = @orchestrationId);
END
GO
