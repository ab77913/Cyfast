IF @searchQuery = ''
    BEGIN
    EXEC USP_GET_PROJECT_BACKWARD_TRACEABILITY @projectId = @projectId
    END
ELSE
    BEGIN
    EXEC USP_GET_PROJECT_BW_SEARCH_MANY_TRACEABILITY @projectId = @projectId, @searchQuery = @searchQuery
    END
