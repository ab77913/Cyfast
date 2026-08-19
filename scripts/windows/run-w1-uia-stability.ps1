[CmdletBinding()]
param(
    [ValidateRange(1, 100)]
    [int]$Iterations = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$solution = Join-Path $repoRoot 'windows\CyFast.Windows.sln'
$resultsDirectory = Join-Path $repoRoot 'docs\windows'
$jsonPath = Join-Path $resultsDirectory 'W1_UIA_STABILITY.json'
$markdownPath = Join-Path $resultsDirectory 'W1_UIA_STABILITY.md'

Get-Process -Name 'CyFast.Windows.TestFixture' -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue

$runs = @()
$overall = [System.Diagnostics.Stopwatch]::StartNew()
for ($iteration = 1; $iteration -le $Iterations; $iteration++) {
    Get-Process -Name 'CyFast.Windows.TestFixture' -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue

    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    & dotnet test $solution --filter 'Category=UiaIntegration' --logger 'console;verbosity=detailed'
    $exitCode = $LASTEXITCODE
    $timer.Stop()

    $run = [ordered]@{
        iteration = $iteration
        startedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
        durationSeconds = [Math]::Round($timer.Elapsed.TotalSeconds, 3)
        exitCode = $exitCode
        passed = ($exitCode -eq 0)
    }
    $runs += $run
    if ($exitCode -ne 0) { break }
}
$overall.Stop()

$report = [ordered]@{
    generatedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    requestedIterations = $Iterations
    completedIterations = $runs.Count
    passed = ($runs.Count -eq $Iterations -and @($runs | Where-Object { -not $_.passed }).Count -eq 0)
    durationSeconds = [Math]::Round($overall.Elapsed.TotalSeconds, 3)
    runs = $runs
}
$report | ConvertTo-Json -Depth 4 | Set-Content -Path $jsonPath -Encoding utf8

$rows = $runs | ForEach-Object {
    "| $($_.iteration) | $($_.startedAtUtc) | $($_.durationSeconds) | $($_.exitCode) | $($_.passed) |"
}
@(
    '# W1 UIA stability run'
    ''
    "- Generated: $($report.generatedAtUtc)"
    "- Requested iterations: $($report.requestedIterations)"
    "- Completed iterations: $($report.completedIterations)"
    "- Passed: $($report.passed)"
    "- Total duration (seconds): $($report.durationSeconds)"
    ''
    '| Run | Started (UTC) | Duration (s) | Exit code | Passed |'
    '| --- | --- | ---: | ---: | --- |'
    $rows
) | Set-Content -Path $markdownPath -Encoding utf8

if (-not $report.passed) {
    exit 1
}
