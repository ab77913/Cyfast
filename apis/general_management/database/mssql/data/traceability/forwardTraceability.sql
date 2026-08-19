IF @searchQuery = ''
    BEGIN
    EXEC USP_GET_PROJECT_FORWARD_TRACEABILITY @projectId = @projectId
    END
ELSE
    BEGIN
    EXEC USP_GET_PROJECT_FW_SEARCH_MANY_TRACEABILITY @projectId = @projectId, @searchQuery = @searchQuery
    END
