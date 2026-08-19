-- File: updated_procedures.sql
USE cyfast3;

DELIMITER //

-- =============================================
-- Procedure: usp_get_execution_statistics
-- Description: Get execution stats for common dashboard
-- =============================================
CREATE PROCEDURE usp_get_execution_statistics(IN organizationId INT)
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
                AND r.requirement_version = rt.requirement_version
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
END //

-- =============================================
-- Procedure: usp_get_project_backward_traceability
-- =============================================
CREATE PROCEDURE usp_get_project_backward_traceability(IN projectId BIGINT)
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
              WHERE project_id = projectId 
              GROUP BY test_case_id) itce
         ON tce.test_case_id = itce.test_case_id 
         AND ((itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) 
         OR (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id))
         ) ltce
        ON tc.test_case_id = ltce.test_case_id
        LEFT JOIN orchestration AS o
        ON ltce.orchestration_id = o.orchestration_id
    WHERE rq.project_id = projectId 
    ORDER BY tc.test_case_id, rq.requirement_id ASC;
END //

-- =============================================
-- Procedure: usp_get_project_execution_duration
-- =============================================
CREATE PROCEDURE usp_get_project_execution_duration(IN projectId INT)
BEGIN
    SELECT 
        IFNULL(SUM(CAST(oe.elapsed_time AS DECIMAL(10,2))), 0) AS total_elapsed_time
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
                project_id = projectId 
                AND elapsed_time IS NOT NULL 
            GROUP BY 
                orchestration_id
        ) ioe
    ON oe.project_id = projectId 
    AND oe.orchestration_id = ioe.orchestration_id 
    AND oe.end_time = ioe.latest_end_time;
END //

-- =============================================
-- Procedure: usp_get_project_forward_traceability
-- =============================================
CREATE PROCEDURE usp_get_project_forward_traceability4(IN projectId INT, IN testCaseIds TEXT)
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
                 WHERE project_id = projectId 
                 GROUP BY test_case_id) itce
            ON tce.test_case_id = itce.test_case_id 
            AND ((itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) 
            OR (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id))
        ) ltce
    ON tc.test_case_id = ltce.test_case_id
    LEFT JOIN orchestration o
        ON ltce.orchestration_id = o.orchestration_id
    WHERE rq.project_id = projectId
    ORDER BY rq.requirement_id, tc.test_case_id ASC;
END //

DELIMITER ;

-- Stored Procedure 1
DELIMITER //

CREATE PROCEDURE usp_get_requirement_status_count (IN projectId INT)
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
                project_id = projectId 
            GROUP BY 
                test_case_id
        ) itce 
            ON tce.test_case_id = itce.test_case_id 
            AND (
                (itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) OR 
                (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id)
            )
    WHERE 
        tce.project_id = projectId;
END //

DELIMITER ;

-- Stored Procedure 2
DELIMITER //

CREATE PROCEDURE usp_get_test_case_status_count (
    IN projectId INT,
    IN orchestrationId BIGINT
)
BEGIN
    SELECT
        COUNT(*) AS total_count,
        SUM(IF(tce.status = 'FAILED', 1, 0)) AS failed_count,
        SUM(IF(tce.status = 'PASSED', 1, 0)) AS passed_count,
        SUM(IF(tce.status = 'ERROR', 1, 0)) AS error_count,
        SUM(IF(tce.status = 'NOT EXECUTED', 1, 0)) AS not_executed_count,
        SUM(IF(tce.status = 'PAUSED', 1, 0)) AS paused_count,
        SUM(IF(tce.status = 'INPROGRESS', 1, 0)) AS in_progress_count
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
                (projectId IS NOT NULL AND project_id = projectId) 
                OR (orchestrationId IS NOT NULL AND orchestration_id = orchestrationId)
            GROUP BY test_case_id
        ) itce 
            ON tce.test_case_id = itce.test_case_id 
            AND (
                (itce.latest_end_time IS NOT NULL AND tce.end_time = itce.latest_end_time) 
                OR (itce.latest_end_time IS NULL AND tce.test_case_execution_id = itce.max_test_case_execution_id)
            )
    WHERE 
        (projectId IS NOT NULL AND tce.project_id = projectId) 
        OR (orchestrationId IS NOT NULL AND tce.orchestration_id = orchestrationId);
END //

DELIMITER ;

-- Stored Procedure 3
DELIMITER //

CREATE PROCEDURE usp_get_test_script_status_count (
    IN projectId INT,
    IN orchestrationId BIGINT
)
BEGIN
    SELECT
        COUNT(*) AS total_count,
        SUM(IF(tse.status = 'FAILED', 1, 0)) AS failed_count,
        SUM(IF(tse.status = 'PASSED', 1, 0)) AS passed_count,
        SUM(IF(tse.status = 'ERROR', 1, 0)) AS error_count,
        SUM(IF(tse.status = 'NOT EXECUTED', 1, 0)) AS not_executed_count,
        SUM(IF(tse.status = 'PAUSED', 1, 0)) AS paused_count,
        SUM(IF(tse.status = 'INPROGRESS', 1, 0)) AS in_progress_count
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
                (projectId IS NOT NULL AND project_id = projectId) 
                OR (orchestrationId IS NOT NULL AND orchestration_id = orchestrationId)
            GROUP BY test_script_id
        ) itse 
            ON tse.test_script_id = itse.test_script_id 
            AND (
                (itse.latest_end_time IS NOT NULL AND tse.end_time = itse.latest_end_time) 
                OR (itse.latest_end_time IS NULL AND tse.test_script_execution_id = itse.max_test_script_execution_id)
            )
    WHERE 
        (projectId IS NOT NULL AND tse.project_id = projectId) 
        OR (orchestrationId IS NOT NULL AND tse.orchestration_id = orchestrationId);
END //

DELIMITER ;
