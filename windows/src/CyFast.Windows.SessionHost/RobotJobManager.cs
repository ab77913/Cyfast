using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using CyFast.Windows.Contracts;

namespace CyFast.Windows.SessionHost;

/// <summary>
/// Materializes bounded, self-contained Robot packages and executes only the locally
/// approved Robot executable. Package data can never select an arbitrary executable.
/// </summary>
public sealed class RobotJobManager : IDisposable
{
    public const int HardPackageLimitBytes = 225_280;
    private const int MaxFiles = 128;
    private const long MaxReturnedArtifactBytes = 20L * 1024 * 1024;
    private static readonly TimeSpan RuntimeProofMaximumAge = TimeSpan.FromMinutes(5);

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".robot", ".resource", ".py", ".json", ".yaml", ".yml", ".txt", ".csv", ".xml"
    };

    private static readonly string[] MeaningfulActionKeywords =
    {
        "click element", "click button", "input text", "press keys", "select from list",
        "set value", "invoke element", "launch application", "open application", "tap"
    };

    private static readonly string[] MeaningfulAssertionKeywords =
    {
        "element should be visible", "element should be enabled", "wait until element is visible",
        "should be equal", "should contain", "should be true", "page should contain", "title should be"
    };

    private readonly ConcurrentDictionary<string, RobotJob> _jobs = new(StringComparer.Ordinal);
    private readonly string _rootDirectory;
    private readonly string _robotExecutable;
    private readonly Func<WindowsRuntimeStatus?>? _runtimeStatusProvider;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public RobotJobManager(
        string? rootDirectory = null,
        string? robotExecutable = null,
        Func<WindowsRuntimeStatus?>? runtimeStatusProvider = null)
    {
        _rootDirectory = rootDirectory ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CyFast",
            "robot-jobs");
        _robotExecutable = robotExecutable
            ?? Environment.GetEnvironmentVariable("CYFAST_ROBOT_EXECUTABLE")
            ?? (OperatingSystem.IsWindows() ? "robot.exe" : "robot");
        _runtimeStatusProvider = runtimeStatusProvider;
        Directory.CreateDirectory(_rootDirectory);
    }

    public RobotPackageValidationResult Validate(JsonElement payload)
    {
        RobotPackageRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<RobotPackageRequest>(payload.GetRawText(), _jsonOptions);
        }
        catch (JsonException exception)
        {
            return Invalid($"Package payload is invalid JSON: {exception.Message}");
        }

        return request is null ? Invalid("Robot package request is required.") : Validate(request);
    }

    public RobotPackageValidationResult Validate(RobotPackageRequest request)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        var decoded = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        long totalBytes = 0;

        if (string.IsNullOrWhiteSpace(request.ExecutionId) || request.ExecutionId.Length > 128)
            errors.Add("executionId is required and must be at most 128 characters.");
        if (request.Files is null || request.Files.Count == 0)
            errors.Add("At least one package file is required.");
        else if (request.Files.Count > MaxFiles)
            errors.Add($"Package contains more than {MaxFiles} files.");

        var configuredLimit = Math.Clamp(request.MaxPackageBytes, 1, HardPackageLimitBytes);
        foreach (var file in request.Files ?? Array.Empty<RobotPackageFile>())
        {
            string path;
            try { path = NormalizeRelativePath(file.Path); }
            catch (InvalidDataException exception) { errors.Add(exception.Message); continue; }

            if (!AllowedExtensions.Contains(Path.GetExtension(path)))
            {
                errors.Add($"Unsupported package file type: {path}");
                continue;
            }
            if (decoded.ContainsKey(path))
            {
                errors.Add($"Duplicate package path: {path}");
                continue;
            }

            byte[] bytes;
            try { bytes = Convert.FromBase64String(file.ContentBase64 ?? string.Empty); }
            catch (FormatException) { errors.Add($"File is not valid base64: {path}"); continue; }

            totalBytes += bytes.Length;
            if (totalBytes > configuredLimit)
                errors.Add($"Package exceeds the {configuredLimit}-byte limit.");
            if (!string.IsNullOrWhiteSpace(file.Sha256))
            {
                var actual = Convert.ToHexString(SHA256.HashData(bytes));
                if (!actual.Equals(file.Sha256, StringComparison.OrdinalIgnoreCase))
                    errors.Add($"Checksum mismatch: {path}");
            }
            decoded[path] = bytes;
        }

        var robotFiles = decoded.Keys.Where(path => path.EndsWith(".robot", StringComparison.OrdinalIgnoreCase)).ToArray();
        if (robotFiles.Length == 0) errors.Add("At least one .robot suite is required.");

        string? suitePath = null;
        if (!string.IsNullOrWhiteSpace(request.SuitePath))
        {
            try { suitePath = NormalizeRelativePath(request.SuitePath); }
            catch (InvalidDataException exception) { errors.Add(exception.Message); }
            if (suitePath is not null && !decoded.ContainsKey(suitePath))
                errors.Add($"Configured suitePath is missing: {suitePath}");
            if (suitePath is not null && !suitePath.EndsWith(".robot", StringComparison.OrdinalIgnoreCase))
                errors.Add("suitePath must reference a .robot file.");
        }
        else
        {
            suitePath = robotFiles.FirstOrDefault();
        }

        var meaningfulActions = 0;
        var meaningfulAssertions = 0;
        foreach (var (path, bytes) in decoded)
        {
            string text;
            try { text = new UTF8Encoding(false, true).GetString(bytes); }
            catch (DecoderFallbackException) { errors.Add($"Text package file is not valid UTF-8: {path}"); continue; }

            ValidateText(path, text, decoded.Keys, request.AllowCoordinateAutomation, errors, warnings,
                ref meaningfulActions, ref meaningfulAssertions);
        }

        if (meaningfulActions == 0) errors.Add("Robot package has no meaningful UI action.");
        if (meaningfulAssertions == 0) errors.Add("Robot package has no meaningful assertion.");

        return new RobotPackageValidationResult(
            errors.Count == 0,
            suitePath,
            totalBytes,
            meaningfulActions,
            meaningfulAssertions,
            errors.Distinct(StringComparer.Ordinal).ToArray(),
            warnings.Distinct(StringComparer.Ordinal).ToArray());
    }

    public Task<RobotJobStatus> StartAsync(JsonElement payload, CancellationToken cancellationToken)
    {
        var request = JsonSerializer.Deserialize<RobotPackageRequest>(payload.GetRawText(), _jsonOptions)
            ?? throw new InvalidDataException("Robot package request is required.");
        var validation = Validate(request);
        if (!validation.Valid)
            throw new RobotPackageException(ErrorCode.PACKAGE_VALIDATION_FAILED, string.Join(" | ", validation.Errors));

        var runtimeProof = _runtimeStatusProvider?.Invoke();
        if (!IsAcceptableRuntimeProof(runtimeProof))
            throw new RobotPackageException(
                ErrorCode.DRIVER_SESSION_FAILED,
                "A recent successful real Windows runtime and W3C session verification is required before Robot execution.");

        var jobId = Guid.NewGuid().ToString("N");
        var workspace = SafeChildPath(_rootDirectory, jobId);
        var job = new RobotJob(jobId, request.ExecutionId, workspace, validation, runtimeProof!, new CancellationTokenSource());
        if (!_jobs.TryAdd(jobId, job)) throw new InvalidOperationException("Unable to allocate Robot job.");

        job.ExecutionTask = ExecuteAsync(job, request, cancellationToken);
        return Task.FromResult(job.StatusSnapshot());
    }

    public RobotJobStatus GetStatus(JsonElement payload) => GetJob(payload).StatusSnapshot();

    public async Task<RobotJobStatus> CancelAsync(JsonElement payload, CancellationToken cancellationToken)
    {
        var job = GetJob(payload);
        job.Cancellation.Cancel();
        TerminateTrackedRobot(job);
        if (job.ExecutionTask is not null)
        {
            try { await job.ExecutionTask.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken).ConfigureAwait(false); }
            catch (TimeoutException) { }
            catch (OperationCanceledException) when (job.Cancellation.IsCancellationRequested) { }
        }
        return job.StatusSnapshot();
    }

    public async Task<RobotJobResult> CollectAsync(JsonElement payload, CancellationToken cancellationToken)
    {
        var job = GetJob(payload);
        if (job.ExecutionTask is not null)
            await job.ExecutionTask.WaitAsync(cancellationToken).ConfigureAwait(false);
        return job.Result ?? throw new InvalidOperationException("Robot result is not available.");
    }

    private async Task ExecuteAsync(RobotJob job, RobotPackageRequest request, CancellationToken callerToken)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(callerToken, job.Cancellation.Token);
        linked.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(request.TimeoutSeconds, 30, 86_400)));
        var cancellationToken = linked.Token;
        var started = DateTimeOffset.UtcNow;
        job.StartedAt = started;
        job.Status = "VALIDATING_PACKAGE";

        try
        {
            MaterializePackage(request, job.Workspace);
            var suitePath = SafeChildPath(job.Workspace, job.Validation.SuitePath!);
            var environment = BuildEnvironment(request);

            job.Status = "DRY_RUN";
            var dryRun = await RunRobotAsync(
                job,
                new[] { "--dryrun", "--output", "NONE", "--log", "NONE", "--report", "NONE", suitePath },
                Path.Combine(job.Workspace, "dryrun"),
                environment,
                cancellationToken).ConfigureAwait(false);
            if (dryRun.ExitCode != 0)
                throw new RobotPackageException(
                    ClassifyDryRun(dryRun.Stdout, dryRun.Stderr),
                    FirstUsefulMessage(dryRun.Stderr, dryRun.Stdout, "Robot dry run failed."));

            job.Status = "RUNNING";
            var artifactDirectory = Path.Combine(job.Workspace, "artifacts");
            Directory.CreateDirectory(artifactDirectory);
            var run = await RunRobotAsync(
                job,
                new[]
                {
                    "--outputdir", artifactDirectory,
                    "--output", "output.xml",
                    "--log", "log.html",
                    "--report", "report.html",
                    suitePath
                },
                artifactDirectory,
                environment,
                cancellationToken).ConfigureAwait(false);

            await File.WriteAllTextAsync(Path.Combine(artifactDirectory, "stdout.log"), run.Stdout, CancellationToken.None).ConfigureAwait(false);
            await File.WriteAllTextAsync(Path.Combine(artifactDirectory, "stderr.log"), run.Stderr, CancellationToken.None).ConfigureAwait(false);

            job.Status = "COLLECTING_ARTIFACTS";
            var proof = ParseProof(Path.Combine(artifactDirectory, "output.xml"));
            var passed = run.ExitCode == 0 && proof.Actions > 0 && proof.Assertions > 0;
            var classification = passed ? null : ClassifyFailure(proof.FailureMessage, run.Stdout, run.Stderr, run.ExitCode);
            var finished = DateTimeOffset.UtcNow;

            job.Status = passed ? "PASSED" : "FAILED";
            job.FinishedAt = finished;
            job.RobotExitCode = run.ExitCode;
            job.FailureClassification = classification;
            job.FailureMessage = passed ? null : proof.FailureMessage ?? FirstUsefulMessage(run.Stderr, run.Stdout, "Robot execution failed.");
            job.Result = BuildResult(
                job, started, finished, job.Status, run.ExitCode, proof.Actions, proof.Assertions,
                run.Stdout, run.Stderr, classification, job.FailureMessage, CollectArtifacts(artifactDirectory));
        }
        catch (OperationCanceledException)
        {
            TerminateTrackedRobot(job);
            var timedOut = !job.Cancellation.IsCancellationRequested;
            var finished = DateTimeOffset.UtcNow;
            job.Status = timedOut ? "FAILED" : "CANCELLED";
            job.FinishedAt = finished;
            job.FailureClassification = timedOut ? "EXECUTION_TIMEOUT" : "EXECUTION_CANCELLED";
            job.FailureMessage = timedOut
                ? "Robot execution exceeded its configured timeout."
                : "Robot execution was cancelled.";
            job.Result = BuildResult(
                job, started, finished, job.Status, null, 0, 0, string.Empty, string.Empty,
                job.FailureClassification, job.FailureMessage, CollectExistingArtifacts(job.Workspace));
        }
        catch (RobotPackageException exception)
        {
            CompleteFailure(job, started, exception.Code.ToString(), exception.Message);
        }
        catch (Exception exception)
        {
            CompleteFailure(job, started, ErrorCode.ROBOT_EXECUTION_FAILED.ToString(), Bounded(exception.Message, 4096));
        }
        finally
        {
            job.Process?.Dispose();
            job.Process = null;
        }
    }

    private async Task<ProcessResult> RunRobotAsync(
        RobotJob job,
        IReadOnlyList<string> arguments,
        string workingDirectory,
        IReadOnlyDictionary<string, string> environment,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(workingDirectory);
        var startInfo = new ProcessStartInfo
        {
            FileName = _robotExecutable,
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var argument in arguments) startInfo.ArgumentList.Add(argument);
        foreach (var pair in environment) startInfo.Environment[pair.Key] = pair.Value;

        var process = Process.Start(startInfo)
            ?? throw new RobotPackageException(ErrorCode.ROBOT_EXECUTION_FAILED, "Robot executable could not be started.");
        job.Process = process;
        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
        var stdout = await stdoutTask.ConfigureAwait(false);
        var stderr = await stderrTask.ConfigureAwait(false);
        var exitCode = process.ExitCode;
        job.Process = null;
        process.Dispose();
        return new ProcessResult(exitCode, stdout, stderr);
    }

    private static RobotJobResult BuildResult(
        RobotJob job,
        DateTimeOffset started,
        DateTimeOffset finished,
        string status,
        int? exitCode,
        int actions,
        int assertions,
        string stdout,
        string stderr,
        string? classification,
        string? message,
        IReadOnlyList<RobotArtifact> artifacts)
    {
        var proof = job.RuntimeProof;
        return new RobotJobResult(
            JobId: job.JobId,
            ExecutionId: job.ExecutionId,
            Status: status,
            RealExecution: proof.RealExecution,
            Simulated: proof.Simulated,
            DesktopExecution: proof.DesktopExecution,
            RuntimeOs: proof.RuntimeOs,
            Host: Environment.MachineName,
            AppiumUrl: proof.DriverSession.AppiumUrl,
            ApplicationPath: proof.Application.ExecutablePath,
            RuntimeProofSessionId: proof.DriverSession.SessionId,
            RuntimeProofVerifiedAt: proof.DriverSession.LastVerifiedAt,
            SessionCreated: proof.DriverSession.SessionCreated,
            RobotExitCode: exitCode,
            MeaningfulActions: actions,
            MeaningfulAssertions: assertions,
            StartedAt: started,
            FinishedAt: finished,
            DurationMs: Math.Max(0, (long)(finished - started).TotalMilliseconds),
            Stdout: Bounded(stdout, 1_000_000),
            Stderr: Bounded(stderr, 1_000_000),
            FailureClassification: classification,
            FailureMessage: message,
            Artifacts: artifacts);
    }

    private static bool IsAcceptableRuntimeProof(WindowsRuntimeStatus? status) =>
        status is
        {
            Ready: true,
            RealExecution: true,
            Simulated: false,
            DesktopExecution: true,
            RuntimeOs: "Windows",
            DriverSession.Ready: true,
            DriverSession.SessionCreated: true,
            Application.PathExists: true
        } &&
        status.DriverSession.LastVerifiedAt is { } verifiedAt &&
        DateTimeOffset.UtcNow - verifiedAt <= RuntimeProofMaximumAge;

    private static void TerminateTrackedRobot(RobotJob job)
    {
        var process = job.Process;
        if (process is null) return;
        try
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
        }
        catch (InvalidOperationException) { }
        catch (System.ComponentModel.Win32Exception) { }
    }

    private static void MaterializePackage(RobotPackageRequest request, string workspace)
    {
        Directory.CreateDirectory(workspace);
        foreach (var file in request.Files)
        {
            var destination = SafeChildPath(workspace, NormalizeRelativePath(file.Path));
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.WriteAllBytes(destination, Convert.FromBase64String(file.ContentBase64));
        }
    }

    private static IReadOnlyDictionary<string, string> BuildEnvironment(RobotPackageRequest request)
    {
        var environment = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var pair in request.Environment ?? new Dictionary<string, string>())
        {
            ValidateEnvironmentName(pair.Key);
            if (pair.Value.Length > 16_384) throw new InvalidDataException($"Environment value is too large: {pair.Key}");
            environment[pair.Key] = pair.Value;
        }
        foreach (var pair in request.EnvironmentReferences ?? new Dictionary<string, string>())
        {
            ValidateEnvironmentName(pair.Key);
            ValidateEnvironmentName(pair.Value);
            var value = Environment.GetEnvironmentVariable(pair.Value);
            if (value is null)
                throw new RobotPackageException(
                    ErrorCode.PACKAGE_VALIDATION_FAILED,
                    $"Required local environment reference is unavailable: {pair.Value}");
            environment[pair.Key] = value;
        }
        return environment;
    }

    private static void ValidateText(
        string path,
        string text,
        IEnumerable<string> packagePaths,
        bool allowCoordinateAutomation,
        ICollection<string> errors,
        ICollection<string> warnings,
        ref int meaningfulActions,
        ref int meaningfulAssertions)
    {
        if (text.Contains("/home/", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("/tmp/", StringComparison.OrdinalIgnoreCase))
            errors.Add($"Unresolved Linux-only path in {path}.");
        if (Regex.IsMatch(text, @"(?i)desiredCapabilities"))
            errors.Add($"Legacy desiredCapabilities is not allowed in {path}.");
        foreach (var capability in new[] { "automationName", "app", "deviceName", "newCommandTimeout" })
        {
            if (Regex.IsMatch(text, $"(?i)[\"']{capability}[\"']\\s*:") &&
                !Regex.IsMatch(text, $"(?i)[\"']appium:{capability}[\"']\\s*:"))
                errors.Add($"Legacy unprefixed Appium capability '{capability}' in {path}.");
        }
        if (Regex.IsMatch(text, @"(?im)^\s*(?:#\s*)?(?:TODO|FIXME)\b") ||
            Regex.IsMatch(text, @"(?i)<locator>|replace_me|your_locator|placeholder_locator"))
            errors.Add($"TODO or placeholder automation remains in {path}.");
        if (Regex.IsMatch(text, @"(?im)^\s*\$\{(?:PASSWORD|TOKEN|SECRET|API_KEY)\}\s{2,}(?!%\{|\$\{)[^#\s].+$"))
            errors.Add($"Possible plaintext credential assignment in {path}; use an environment reference.");

        var normalized = text.ToLowerInvariant();
        meaningfulActions += MeaningfulActionKeywords.Sum(keyword => CountKeywordLines(normalized, keyword));
        meaningfulAssertions += MeaningfulAssertionKeywords.Sum(keyword => CountKeywordLines(normalized, keyword));

        var coordinateActions = Regex.Matches(text, @"(?im)^\s*(?:click at|click coordinates?|tap at)\b").Count;
        if (coordinateActions > 0 && !allowCoordinateAutomation)
            errors.Add($"Coordinate-only automation is not permitted in {path}.");
        else if (coordinateActions > 0)
            warnings.Add($"Coordinate automation is enabled for {path}; semantic locators remain preferred.");

        if (!path.EndsWith(".robot", StringComparison.OrdinalIgnoreCase) &&
            !path.EndsWith(".resource", StringComparison.OrdinalIgnoreCase)) return;

        var available = packagePaths.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (Match match in Regex.Matches(text, @"(?im)^\s*Resource\s{2,}([^#\r\n]+)"))
            ValidateImportedPath(path, match.Groups[1].Value.Trim(), available, errors, "resource");
        foreach (Match match in Regex.Matches(text, @"(?im)^\s*Library\s{2,}([^#\r\n]+\.py)\s*$"))
            ValidateImportedPath(path, match.Groups[1].Value.Trim(), available, errors, "Python library");
    }

    private static void ValidateImportedPath(
        string sourcePath,
        string imported,
        IReadOnlySet<string> packagePaths,
        ICollection<string> errors,
        string kind)
    {
        if (imported.Contains("${", StringComparison.Ordinal) || imported.Contains("%{", StringComparison.Ordinal)) return;
        imported = imported.Trim('"', '\'');
        try
        {
            var sourceDirectory = Path.GetDirectoryName(sourcePath)?.Replace('\\', '/') ?? string.Empty;
            var combined = NormalizeRelativePath(Path.Combine(sourceDirectory, imported).Replace('\\', '/'));
            if (!packagePaths.Contains(combined)) errors.Add($"Missing {kind} referenced by {sourcePath}: {combined}");
        }
        catch (InvalidDataException)
        {
            errors.Add($"Unsafe {kind} path referenced by {sourcePath}: {imported}");
        }
    }

    private static int CountKeywordLines(string text, string keyword) =>
        Regex.Matches(text, $@"(?im)^\s*{Regex.Escape(keyword)}(?:\s{{2,}}|\s*$)").Count;

    public static string NormalizeRelativePath(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new InvalidDataException("Package path is empty.");
        var path = value.Replace('\\', '/').Trim();
        if (path.StartsWith('/', StringComparison.Ordinal) || Path.IsPathFullyQualified(path) || Regex.IsMatch(path, @"^[A-Za-z]:"))
            throw new InvalidDataException($"Absolute package path is not allowed: {value}");
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0 || segments.Any(segment => segment is "." or ".." || segment.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0))
            throw new InvalidDataException($"Unsafe package path: {value}");
        return string.Join('/', segments);
    }

    private static string SafeChildPath(string root, string relative)
    {
        var normalized = NormalizeRelativePath(relative);
        var rootFull = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var full = Path.GetFullPath(Path.Combine(rootFull, normalized.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Package path escapes the job workspace.");
        return full;
    }

    private static void ValidateEnvironmentName(string name)
    {
        if (!Regex.IsMatch(name, "^[A-Za-z_][A-Za-z0-9_]{0,127}$"))
            throw new InvalidDataException($"Invalid environment variable name: {name}");
    }

    private static Proof ParseProof(string outputPath)
    {
        if (!File.Exists(outputPath)) return new Proof(0, 0, "Robot output.xml is missing.");
        try
        {
            var document = XDocument.Load(outputPath, LoadOptions.None);
            var passedKeywords = document.Descendants("kw")
                .Where(keyword => string.Equals(
                    keyword.Elements("status").LastOrDefault()?.Attribute("status")?.Value,
                    "PASS",
                    StringComparison.OrdinalIgnoreCase))
                .Select(keyword => keyword.Attribute("name")?.Value?.Trim().ToLowerInvariant() ?? string.Empty)
                .ToArray();
            var actions = passedKeywords.Count(name => MeaningfulActionKeywords.Any(keyword => name.Contains(keyword, StringComparison.Ordinal)));
            var assertions = passedKeywords.Count(name => MeaningfulAssertionKeywords.Any(keyword => name.Contains(keyword, StringComparison.Ordinal)));
            var firstFailure = document.Descendants("status")
                .FirstOrDefault(status => string.Equals(status.Attribute("status")?.Value, "FAIL", StringComparison.OrdinalIgnoreCase))
                ?.Value?.Trim();
            return new Proof(actions, assertions, string.IsNullOrWhiteSpace(firstFailure) ? null : Bounded(firstFailure, 4096));
        }
        catch (Exception exception) when (exception is IOException or System.Xml.XmlException)
        {
            return new Proof(0, 0, $"Robot output.xml could not be parsed: {exception.Message}");
        }
    }

    private static IReadOnlyList<RobotArtifact> CollectArtifacts(string directory)
    {
        var artifacts = new List<RobotArtifact>();
        long returnedBytes = 0;
        foreach (var path in Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories)
                     .OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
        {
            var info = new FileInfo(path);
            if (info.Length > MaxReturnedArtifactBytes || returnedBytes + info.Length > MaxReturnedArtifactBytes) continue;
            var bytes = File.ReadAllBytes(path);
            returnedBytes += bytes.Length;
            artifacts.Add(new RobotArtifact(
                ArtifactType(path),
                Path.GetFileName(path),
                ContentType(path),
                bytes.LongLength,
                Convert.ToHexString(SHA256.HashData(bytes)),
                Convert.ToBase64String(bytes)));
        }
        return artifacts;
    }

    private static IReadOnlyList<RobotArtifact> CollectExistingArtifacts(string workspace)
    {
        var artifactDirectory = Path.Combine(workspace, "artifacts");
        return Directory.Exists(artifactDirectory) ? CollectArtifacts(artifactDirectory) : Array.Empty<RobotArtifact>();
    }

    private static string ArtifactType(string path) => Path.GetFileName(path).ToLowerInvariant() switch
    {
        "output.xml" => "ROBOT_OUTPUT_XML",
        "log.html" => "ROBOT_LOG_HTML",
        "report.html" => "ROBOT_REPORT_HTML",
        "stdout.log" => "STDOUT",
        "stderr.log" => "STDERR",
        _ when Path.GetExtension(path).Equals(".png", StringComparison.OrdinalIgnoreCase) => "SCREENSHOT",
        _ => "ROBOT_ARTIFACT"
    };

    private static string ContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".xml" => "application/xml",
        ".html" => "text/html; charset=utf-8",
        ".log" or ".txt" => "text/plain; charset=utf-8",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        _ => "application/octet-stream"
    };

    private static ErrorCode ClassifyDryRun(string stdout, string stderr)
    {
        var combined = stdout + "\n" + stderr;
        return Regex.IsMatch(combined, @"(?i)(resource|library|keyword).*(not found|does not exist|failed to import)")
            ? ErrorCode.KEYWORD_IMPORT_DEFECT
            : ErrorCode.SCRIPT_DEFECT;
    }

    private static string ClassifyFailure(string? outputFailure, string stdout, string stderr, int exitCode)
    {
        var combined = string.Join("\n", outputFailure, stdout, stderr);
        if (Regex.IsMatch(combined, @"(?i)(element|locator).*(not found|did not match|unable to locate)")) return "LOCATOR_FAILURE";
        if (Regex.IsMatch(combined, @"(?i)(should|assert).*(failed|not equal|not visible|does not contain)")) return "ASSERTION_FAILURE";
        if (Regex.IsMatch(combined, @"(?i)(resource|library|keyword).*(not found|failed to import|no keyword)")) return "KEYWORD_IMPORT_DEFECT";
        return exitCode == 0 ? "PACKAGE_VALIDATION_FAILED" : "ROBOT_EXECUTION_FAILED";
    }

    private static string FirstUsefulMessage(string primary, string secondary, string fallback)
    {
        var value = string.IsNullOrWhiteSpace(primary) ? secondary : primary;
        return string.IsNullOrWhiteSpace(value) ? fallback : Bounded(value.Trim(), 4096);
    }

    private static string Bounded(string value, int maximum) => value.Length <= maximum ? value : value[..maximum];

    private RobotJob GetJob(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object ||
            !payload.TryGetProperty("jobId", out var value) || value.ValueKind != JsonValueKind.String ||
            string.IsNullOrWhiteSpace(value.GetString()))
            throw new RobotPackageException(ErrorCode.InvalidRequest, "jobId is required.");
        var jobId = value.GetString()!;
        return _jobs.TryGetValue(jobId, out var job)
            ? job
            : throw new RobotPackageException(ErrorCode.InvalidRequest, "Robot job was not found.");
    }

    private static RobotPackageValidationResult Invalid(string message) =>
        new(false, null, 0, 0, 0, new[] { message }, Array.Empty<string>());

    private static void CompleteFailure(RobotJob job, DateTimeOffset started, string classification, string message)
    {
        var finished = DateTimeOffset.UtcNow;
        job.Status = "FAILED";
        job.FinishedAt = finished;
        job.FailureClassification = classification;
        job.FailureMessage = message;
        job.Result = BuildResult(
            job, started, finished, job.Status, null, 0, 0, string.Empty, string.Empty,
            classification, message, CollectExistingArtifacts(job.Workspace));
    }

    public void Dispose()
    {
        foreach (var job in _jobs.Values)
        {
            job.Cancellation.Cancel();
            TerminateTrackedRobot(job);
            job.Cancellation.Dispose();
            job.Process?.Dispose();
        }
    }

    private sealed class RobotJob(
        string jobId,
        string executionId,
        string workspace,
        RobotPackageValidationResult validation,
        WindowsRuntimeStatus runtimeProof,
        CancellationTokenSource cancellation)
    {
        private readonly object _gate = new();
        private string _status = "CREATED";
        private DateTimeOffset? _startedAt;
        private DateTimeOffset? _finishedAt;
        private int? _robotExitCode;
        private string? _failureClassification;
        private string? _failureMessage;

        public string JobId { get; } = jobId;
        public string ExecutionId { get; } = executionId;
        public string Workspace { get; } = workspace;
        public RobotPackageValidationResult Validation { get; } = validation;
        public WindowsRuntimeStatus RuntimeProof { get; } = runtimeProof;
        public CancellationTokenSource Cancellation { get; } = cancellation;
        public DateTimeOffset CreatedAt { get; } = DateTimeOffset.UtcNow;
        public Task? ExecutionTask { get; set; }
        public Process? Process { get; set; }
        public RobotJobResult? Result { get; set; }

        public string Status { get { lock (_gate) return _status; } set { lock (_gate) _status = value; } }
        public DateTimeOffset? StartedAt { get { lock (_gate) return _startedAt; } set { lock (_gate) _startedAt = value; } }
        public DateTimeOffset? FinishedAt { get { lock (_gate) return _finishedAt; } set { lock (_gate) _finishedAt = value; } }
        public int? RobotExitCode { get { lock (_gate) return _robotExitCode; } set { lock (_gate) _robotExitCode = value; } }
        public string? FailureClassification { get { lock (_gate) return _failureClassification; } set { lock (_gate) _failureClassification = value; } }
        public string? FailureMessage { get { lock (_gate) return _failureMessage; } set { lock (_gate) _failureMessage = value; } }

        public RobotJobStatus StatusSnapshot()
        {
            lock (_gate)
            {
                return new RobotJobStatus(
                    JobId, ExecutionId, _status, CreatedAt, _startedAt, _finishedAt,
                    _robotExitCode, _failureClassification, _failureMessage);
            }
        }
    }

    private sealed record ProcessResult(int ExitCode, string Stdout, string Stderr);
    private sealed record Proof(int Actions, int Assertions, string? FailureMessage);
}

public sealed class RobotPackageException(ErrorCode code, string message) : Exception(message)
{
    public ErrorCode Code { get; } = code;
}
