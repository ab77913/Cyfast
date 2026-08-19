SELECT 
    TC.*,
    TS.TestScriptName,
    TS.FilePath,
    TS.FileName,
    RRT.RequirementNos
FROM 
    [dbo].[TestCase] TC
    LEFT JOIN 
    [dbo].[TestScript] TS ON TC.TestScriptId = TS.TestScriptId
    LEFT JOIN
    (
        SELECT 
            RT.TestCaseId,
            RT.TestCaseVersion,
            STRING_AGG(R.RequirementNo, ',') as RequirementNos
        FROM
            [dbo].[RequirementTestCase] RT
            INNER JOIN
            [dbo].[Requirement] R ON RT.RequirementId = R.RequirementId AND RT.RequirementVersion = R.RequirementVersion
        GROUP BY RT.TestCaseId, RT.TestCaseVersion
    ) RRT ON TC.TestCaseId = RRT.TestCaseId AND (TC.TestCaseVersion IS NULL OR (TC.TestCaseVersion = RRT.TestCaseVersion))
WHERE
    TC.TestCaseId IN (SELECT value FROM string_split(@testCaseIds,','))