# W1 Acceptance / Readiness Report

Commit: eb4996141a613dc3b8a3b9b518438eca4f614a48
READY_FOR_W2=false
PRODUCTION_GA_READY=false

Mandatory: passed=5 failed=0 blocked=1 total=6

| Id | Name | Status | Detail |
|---|---|---|---|
| clean-tree-start | Repository cleanliness (advisory at start) | PASS |  |
| gm-unit | General Management Windows tests | PASS |  |
| ag-unit | Agent Gateway tests | PASS |  |
| quality | Changed-files quality gate | PASS |  |
| pipeline | Existing CyFAST pipeline regression 3/3 | PASS |  |
| wss | WSS/mTLS E2E 3/3 | PASS |  |
| session-vm | Dedicated VM session-state E2E | BLOCKED | BLOCKED: dedicated VM session-state E2E is not configured |
