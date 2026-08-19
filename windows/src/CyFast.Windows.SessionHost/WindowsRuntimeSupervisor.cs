using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using CyFast.Windows.Contracts;

namespace CyFast.Windows.SessionHost;

/// <summary>
/// Supervises only explicitly configured and CyFAST-owned runtime processes. It never
/// kills a process merely because it owns a configured port, and it never invokes a shell.
/// </summary>
public sealed class WindowsRuntimeSupervisor : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly ConcurrentDictionary<string, Process> _ownedProcesses = new(StringComparer.OrdinalIgnoreCase);
    private readonly SemaphoreSlim _recoveryGate = new(1, 1);
    private readonly string _logDirectory;

    public WindowsRuntimeSupervisor(HttpClient? httpClient = null, string? logDirectory = null)
    {
        _httpClient = httpClient ?? new HttpClient();
        _logDirectory = logDirectory ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "CyFast",
            "logs",
            "windows-runtime");
        Directory.CreateDirectory(_logDirectory);
    }

    public Task<WindowsRuntimeStatus> CheckAsync(JsonElement payload, CancellationToken cancellationToken) =>
        CheckInternalAsync(RuntimeConfiguration.Parse(payload), verifySession: true, cancellationToken);

    public async Task<WindowsRuntimeStatus> RecoverAsync(JsonElement payload, CancellationToken cancellationToken)
    {
        var configuration = RuntimeConfiguration.Parse(payload);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(configuration.RecoveryTimeout);

        await _recoveryGate.WaitAsync(timeout.Token).ConfigureAwait(false);
        try
        {
            var current = await CheckInternalAsync(configuration, verifySession: false, timeout.Token).ConfigureAwait(false);
            if (current.InteractiveSession != SessionState.READY)
                return current;

            if (!current.WinAppDriver.Ready)
            {
                if (string.IsNullOrWhiteSpace(configuration.WinAppDriverExecutable))
                    return await CheckInternalAsync(configuration, verifySession: true, timeout.Token,
                        ErrorCode.WINAPPDRIVER_NOT_FOUND, "WinAppDriver executable is not configured.").ConfigureAwait(false);

                StartOwnedProcess(
                    "winappdriver",
                    configuration.WinAppDriverExecutable,
                    configuration.WinAppDriverArguments,
                    configuration.WorkingDirectory,
                    configuration.Environment);
                if (!await WaitForEndpointAsync(configuration.WinAppDriverStatusUrl, configuration.StartupTimeout, timeout.Token).ConfigureAwait(false))
                    return await CheckInternalAsync(configuration, verifySession: true, timeout.Token,
                        ErrorCode.WINAPPDRIVER_START_FAILED, "WinAppDriver did not become ready before the bounded timeout.").ConfigureAwait(false);
            }

            if (!current.Appium.Ready)
            {
                if (string.IsNullOrWhiteSpace(configuration.AppiumExecutable))
                    return await CheckInternalAsync(configuration, verifySession: true, timeout.Token,
                        ErrorCode.APPIUM_START_FAILED, "Appium executable is not configured.").ConfigureAwait(false);

                StartOwnedProcess(
                    "appium",
                    configuration.AppiumExecutable,
                    configuration.AppiumArguments,
                    configuration.WorkingDirectory,
                    configuration.Environment);
                if (!await WaitForEndpointAsync(configuration.AppiumStatusUrl, configuration.StartupTimeout, timeout.Token).ConfigureAwait(false))
                    return await CheckInternalAsync(configuration, verifySession: true, timeout.Token,
                        ErrorCode.APPIUM_START_FAILED, "Appium did not become ready before the bounded timeout.").ConfigureAwait(false);
            }

            if (configuration.LaunchApplication && !string.IsNullOrWhiteSpace(configuration.ApplicationPath))
            {
                var application = FindProcessByExecutable(configuration.ApplicationPath);
                if (application is null)
                {
                    if (!File.Exists(configuration.ApplicationPath))
                        return await CheckInternalAsync(configuration, verifySession: true, timeout.Token,
                            ErrorCode.APPLICATION_PATH_NOT_FOUND, "Configured application executable does not exist.").ConfigureAwait(false);

                    StartOwnedProcess(
                        "application",
                        configuration.ApplicationPath,
                        configuration.ApplicationArguments,
                        configuration.WorkingDirectory,
                        configuration.Environment,
                        captureOutput: false);
                }

                if (!await WaitForApplicationAsync(configuration, timeout.Token).ConfigureAwait(false))
                    return await CheckInternalAsync(configuration, verifySession: true, timeout.Token,
                        ErrorCode.APPLICATION_WINDOW_NOT_FOUND, "Application process or top-level window did not become ready.").ConfigureAwait(false);
            }

            return await CheckInternalAsync(configuration, verifySession: true, timeout.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return await CheckInternalAsync(configuration, verifySession: false, CancellationToken.None,
                ErrorCode.RUNTIME_RECOVERY_TIMEOUT, "Runtime recovery exceeded its configured timeout.").ConfigureAwait(false);
        }
        finally
        {
            _recoveryGate.Release();
        }
    }

    private async Task<WindowsRuntimeStatus> CheckInternalAsync(
        RuntimeConfiguration configuration,
        bool verifySession,
        CancellationToken cancellationToken,
        ErrorCode injectedError = ErrorCode.None,
        string? injectedMessage = null)
    {
        var checkedAt = DateTimeOffset.UtcNow;
        var errors = new List<string>();
        var desktopError = DesktopState.GetError();
        if (desktopError != ErrorCode.None)
            errors.Add(desktopError.ToString());

        var appiumReady = await EndpointReadyAsync(configuration.AppiumStatusUrl, cancellationToken).ConfigureAwait(false);
        var winAppDriverReady = await EndpointReadyAsync(configuration.WinAppDriverStatusUrl, cancellationToken).ConfigureAwait(false);

        var appiumProcess = OwnedProcess("appium");
        var driverProcess = OwnedProcess("winappdriver");
        var application = string.IsNullOrWhiteSpace(configuration.ApplicationPath)
            ? null
            : FindProcessByExecutable(configuration.ApplicationPath);
        var pathExists = !string.IsNullOrWhiteSpace(configuration.ApplicationPath) && File.Exists(configuration.ApplicationPath);
        var processRunning = application is { HasExited: false };
        var windowFound = processRunning && HasTopLevelWindow(application!);

        RuntimeSessionProof proof;
        if (verifySession && desktopError == ErrorCode.None && appiumReady && pathExists)
            proof = await VerifyW3cSessionAsync(configuration, cancellationToken).ConfigureAwait(false);
        else
            proof = new RuntimeSessionProof(
                Ready: false,
                SessionCreated: false,
                SessionId: null,
                AppiumUrl: configuration.AppiumBaseUrl.ToString(),
                EffectiveCapabilities: null,
                LastVerifiedAt: null,
                ErrorCode: verifySession ? ErrorCode.DRIVER_SESSION_FAILED.ToString() : null,
                Message: verifySession ? "Session verification prerequisites are not ready." : "Session verification was deferred during recovery.");

        if (!appiumReady) errors.Add(ErrorCode.APPIUM_STATUS_FAILED.ToString());
        if (!winAppDriverReady) errors.Add(ErrorCode.WINAPPDRIVER_NOT_FOUND.ToString());
        if (!pathExists) errors.Add(ErrorCode.APPLICATION_PATH_NOT_FOUND.ToString());
        if (configuration.RequireApplicationWindow && !windowFound) errors.Add(ErrorCode.APPLICATION_WINDOW_NOT_FOUND.ToString());
        if (verifySession && !proof.Ready) errors.Add(ErrorCode.DRIVER_SESSION_FAILED.ToString());
        if (injectedError != ErrorCode.None) errors.Add(injectedError.ToString());

        var appiumError = injectedError is ErrorCode.APPIUM_START_FAILED or ErrorCode.APPIUM_STATUS_FAILED
            ? injectedError.ToString()
            : appiumReady ? null : ErrorCode.APPIUM_STATUS_FAILED.ToString();
        var driverError = injectedError is ErrorCode.WINAPPDRIVER_NOT_FOUND or ErrorCode.WINAPPDRIVER_START_FAILED
            ? injectedError.ToString()
            : winAppDriverReady ? null : ErrorCode.WINAPPDRIVER_NOT_FOUND.ToString();

        var status = new WindowsRuntimeStatus(
            Ready: desktopError == ErrorCode.None && appiumReady && winAppDriverReady && pathExists &&
                   (!configuration.RequireApplicationWindow || windowFound) && proof.Ready && injectedError == ErrorCode.None,
            RealExecution: true,
            Simulated: false,
            DesktopExecution: true,
            RuntimeOs: OperatingSystem.IsWindows() ? "Windows" : Environment.OSVersion.Platform.ToString(),
            InteractiveSession: DesktopState.GetSessionState(),
            Agent: new RuntimeComponentStatus(
                Ready: desktopError == ErrorCode.None,
                Endpoint: "named-pipe://CyFast.Windows.SessionHost",
                ProcessId: Environment.ProcessId,
                StartedByCyFast: true,
                LastVerifiedAt: checkedAt,
                ErrorCode: desktopError == ErrorCode.None ? null : desktopError.ToString(),
                Message: desktopError == ErrorCode.None ? "Interactive SessionHost is ready." : "Interactive desktop is unavailable."),
            Appium: new RuntimeComponentStatus(
                Ready: appiumReady,
                Endpoint: configuration.AppiumStatusUrl.ToString(),
                ProcessId: appiumProcess?.Id,
                StartedByCyFast: appiumProcess is not null,
                LastVerifiedAt: appiumReady ? checkedAt : null,
                ErrorCode: appiumError,
                Message: injectedError is ErrorCode.APPIUM_START_FAILED or ErrorCode.APPIUM_STATUS_FAILED ? injectedMessage : null),
            WinAppDriver: new RuntimeComponentStatus(
                Ready: winAppDriverReady,
                Endpoint: configuration.WinAppDriverStatusUrl.ToString(),
                ProcessId: driverProcess?.Id,
                StartedByCyFast: driverProcess is not null,
                LastVerifiedAt: winAppDriverReady ? checkedAt : null,
                ErrorCode: driverError,
                Message: injectedError is ErrorCode.WINAPPDRIVER_NOT_FOUND or ErrorCode.WINAPPDRIVER_START_FAILED ? injectedMessage : null),
            Application: new RuntimeApplicationStatus(
                PathExists: pathExists,
                ProcessRunning: processRunning,
                WindowFound: windowFound,
                ExecutablePath: configuration.ApplicationPath,
                ProcessId: processRunning ? application?.Id : null,
                WindowTitle: processRunning ? SafeWindowTitle(application!) : null),
            DriverSession: proof,
            Errors: errors.Distinct(StringComparer.Ordinal).ToArray(),
            CheckedAt: checkedAt);

        await PersistDiagnosticAsync(status, injectedError == ErrorCode.None && status.Ready, cancellationToken).ConfigureAwait(false);
        return status;
    }

    private async Task<RuntimeSessionProof> VerifyW3cSessionAsync(RuntimeConfiguration configuration, CancellationToken cancellationToken)
    {
        var capabilities = configuration.BuildW3cCapabilities();
        string? sessionId = null;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(configuration.SessionTimeout);
            using var response = await _httpClient.PostAsJsonAsync(configuration.AppiumSessionUrl, capabilities, timeout.Token).ConfigureAwait(false);
            var responseText = await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
                return new RuntimeSessionProof(false, false, null, configuration.AppiumBaseUrl.ToString(),
                    JsonSerializer.SerializeToElement(capabilities), DateTimeOffset.UtcNow,
                    ErrorCode.DRIVER_SESSION_FAILED.ToString(), Sanitize(responseText));

            using var document = JsonDocument.Parse(responseText);
            sessionId = ExtractSessionId(document.RootElement);
            if (string.IsNullOrWhiteSpace(sessionId))
                return new RuntimeSessionProof(false, false, null, configuration.AppiumBaseUrl.ToString(),
                    JsonSerializer.SerializeToElement(capabilities), DateTimeOffset.UtcNow,
                    ErrorCode.DRIVER_SESSION_FAILED.ToString(), "Appium did not return a W3C session ID.");

            return new RuntimeSessionProof(true, true, sessionId, configuration.AppiumBaseUrl.ToString(),
                JsonSerializer.SerializeToElement(capabilities), DateTimeOffset.UtcNow);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new RuntimeSessionProof(false, false, sessionId, configuration.AppiumBaseUrl.ToString(),
                JsonSerializer.SerializeToElement(capabilities), DateTimeOffset.UtcNow,
                ErrorCode.DRIVER_SESSION_FAILED.ToString(), "W3C session verification timed out.");
        }
        catch (Exception exception)
        {
            return new RuntimeSessionProof(false, false, sessionId, configuration.AppiumBaseUrl.ToString(),
                JsonSerializer.SerializeToElement(capabilities), DateTimeOffset.UtcNow,
                ErrorCode.DRIVER_SESSION_FAILED.ToString(), Sanitize(exception.Message));
        }
        finally
        {
            if (!string.IsNullOrWhiteSpace(sessionId))
            {
                try
                {
                    using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                    await _httpClient.DeleteAsync(new Uri(configuration.AppiumSessionUrl, Uri.EscapeDataString(sessionId)), cleanup.Token).ConfigureAwait(false);
                }
                catch
                {
                    // A failed cleanup must never convert a real failed verification into success.
                }
            }
        }
    }

    private void StartOwnedProcess(
        string component,
        string executable,
        IReadOnlyList<string> arguments,
        string? workingDirectory,
        IReadOnlyDictionary<string, string> environment,
        bool captureOutput = true)
    {
        var existing = OwnedProcess(component);
        if (existing is not null) return;

        ValidateExecutable(executable);
        var startInfo = new ProcessStartInfo
        {
            FileName = Path.GetFullPath(executable),
            WorkingDirectory = string.IsNullOrWhiteSpace(workingDirectory)
                ? Path.GetDirectoryName(Path.GetFullPath(executable))!
                : Path.GetFullPath(workingDirectory),
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = captureOutput,
            RedirectStandardError = captureOutput
        };
        foreach (var argument in arguments)
            startInfo.ArgumentList.Add(argument);
        foreach (var pair in environment)
            startInfo.Environment[pair.Key] = pair.Value;

        var process = Process.Start(startInfo) ?? throw new InvalidOperationException($"Unable to start {component}.");
        _ownedProcesses[component] = process;
        if (captureOutput)
        {
            _ = CopyLogAsync(process.StandardOutput, Path.Combine(_logDirectory, $"{component}-stdout.log"));
            _ = CopyLogAsync(process.StandardError, Path.Combine(_logDirectory, $"{component}-stderr.log"));
        }
    }

    private Process? OwnedProcess(string component)
    {
        if (!_ownedProcesses.TryGetValue(component, out var process)) return null;
        try
        {
            if (!process.HasExited) return process;
        }
        catch
        {
            // Treat inaccessible tracked processes as stopped.
        }
        _ownedProcesses.TryRemove(component, out _);
        process.Dispose();
        return null;
    }

    private async Task<bool> WaitForEndpointAsync(Uri statusUrl, TimeSpan timeout, CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;
        while (DateTimeOffset.UtcNow < deadline)
        {
            if (await EndpointReadyAsync(statusUrl, cancellationToken).ConfigureAwait(false)) return true;
            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken).ConfigureAwait(false);
        }
        return false;
    }

    private async Task<bool> WaitForApplicationAsync(RuntimeConfiguration configuration, CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow + configuration.ApplicationTimeout;
        while (DateTimeOffset.UtcNow < deadline)
        {
            var process = FindProcessByExecutable(configuration.ApplicationPath!);
            if (process is { HasExited: false } && (!configuration.RequireApplicationWindow || HasTopLevelWindow(process)))
                return true;
            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken).ConfigureAwait(false);
        }
        return false;
    }

    private async Task<bool> EndpointReadyAsync(Uri statusUrl, CancellationToken cancellationToken)
    {
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(5));
            using var response = await _httpClient.GetAsync(statusUrl, timeout.Token).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private async Task PersistDiagnosticAsync(WindowsRuntimeStatus status, bool successful, CancellationToken cancellationToken)
    {
        var path = Path.Combine(_logDirectory, successful ? "driver-selection.json" : "driver-diagnosis.json");
        var temporary = path + ".tmp";
        await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(status, new JsonSerializerOptions { WriteIndented = true }), cancellationToken).ConfigureAwait(false);
        File.Move(temporary, path, true);
    }

    private static async Task CopyLogAsync(StreamReader reader, string path)
    {
        try
        {
            await using var stream = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite, 4096, useAsync: true);
            await using var writer = new StreamWriter(stream) { AutoFlush = true };
            while (await reader.ReadLineAsync().ConfigureAwait(false) is { } line)
                await writer.WriteLineAsync($"{DateTimeOffset.UtcNow:O} {Sanitize(line)}").ConfigureAwait(false);
        }
        catch
        {
            // Runtime health reporting will expose process failure without leaking log exceptions.
        }
    }

    private static string? ExtractSessionId(JsonElement root)
    {
        if (root.TryGetProperty("sessionId", out var direct) && direct.ValueKind == JsonValueKind.String)
            return direct.GetString();
        if (root.TryGetProperty("value", out var value) && value.ValueKind == JsonValueKind.Object &&
            value.TryGetProperty("sessionId", out var nested) && nested.ValueKind == JsonValueKind.String)
            return nested.GetString();
        return null;
    }

    private static Process? FindProcessByExecutable(string executable)
    {
        if (string.IsNullOrWhiteSpace(executable)) return null;
        var expected = Path.GetFullPath(executable);
        foreach (var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(expected)))
        {
            try
            {
                if (string.Equals(process.MainModule?.FileName, expected, StringComparison.OrdinalIgnoreCase))
                    return process;
            }
            catch
            {
                process.Dispose();
            }
        }
        return null;
    }

    private static bool HasTopLevelWindow(Process process)
    {
        try
        {
            process.Refresh();
            return process.MainWindowHandle != IntPtr.Zero && !string.IsNullOrWhiteSpace(process.MainWindowTitle);
        }
        catch
        {
            return false;
        }
    }

    private static string SafeWindowTitle(Process process)
    {
        try { return process.MainWindowTitle; }
        catch { return string.Empty; }
    }

    private static void ValidateExecutable(string executable)
    {
        if (string.IsNullOrWhiteSpace(executable) || !Path.IsPathFullyQualified(executable))
            throw new InvalidOperationException(ErrorCode.INVALID_RUNTIME_CONFIGURATION.ToString());
        var full = Path.GetFullPath(executable);
        if (!File.Exists(full))
            throw new FileNotFoundException("Configured runtime executable was not found.", full);
        if (!string.Equals(Path.GetExtension(full), ".exe", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Runtime components must be configured as direct executable files; shell scripts are not allowed.");
    }

    private static string Sanitize(string value)
    {
        var sanitized = value.Replace("\r", " ", StringComparison.Ordinal).Replace("\n", " ", StringComparison.Ordinal);
        return sanitized.Length <= 2048 ? sanitized : sanitized[..2048];
    }

    public void Dispose()
    {
        _httpClient.Dispose();
        _recoveryGate.Dispose();
        foreach (var process in _ownedProcesses.Values)
            process.Dispose();
    }

    private sealed record RuntimeConfiguration(
        Uri AppiumBaseUrl,
        Uri AppiumStatusUrl,
        Uri AppiumSessionUrl,
        Uri WinAppDriverStatusUrl,
        string? AppiumExecutable,
        IReadOnlyList<string> AppiumArguments,
        string? WinAppDriverExecutable,
        IReadOnlyList<string> WinAppDriverArguments,
        string? ApplicationPath,
        IReadOnlyList<string> ApplicationArguments,
        string? WorkingDirectory,
        IReadOnlyDictionary<string, string> Environment,
        bool LaunchApplication,
        bool RequireApplicationWindow,
        TimeSpan StartupTimeout,
        TimeSpan ApplicationTimeout,
        TimeSpan SessionTimeout,
        TimeSpan RecoveryTimeout,
        int NewCommandTimeoutSeconds)
    {
        public static RuntimeConfiguration Parse(JsonElement payload)
        {
            var appiumBase = LoopbackUri(String(payload, "appiumUrl", "appium_url") ?? "http://127.0.0.1:4727", "Appium");
            var winAppDriverBase = LoopbackUri(String(payload, "winAppDriverUrl", "win_app_driver_url") ?? "http://127.0.0.1:4723", "WinAppDriver");
            var applicationPath = String(payload, "applicationPath", "application_path");
            if (!string.IsNullOrWhiteSpace(applicationPath))
            {
                if (!Path.IsPathFullyQualified(applicationPath) || ContainsTraversal(applicationPath))
                    throw new InvalidOperationException(ErrorCode.INVALID_RUNTIME_CONFIGURATION.ToString());
                applicationPath = Path.GetFullPath(applicationPath);
            }

            var environment = ParseEnvironment(payload);
            var appiumExecutable = FullPathOrNull(String(payload, "appiumExecutable", "appium_executable"));
            var driverExecutable = FullPathOrNull(String(payload, "winAppDriverExecutable", "win_app_driver_executable", "winAppDriverPath", "win_app_driver_path"));
            var workingDirectory = FullPathOrNull(String(payload, "workingDirectory", "working_directory"));

            return new RuntimeConfiguration(
                appiumBase,
                Endpoint(appiumBase, "status"),
                Endpoint(appiumBase, "session"),
                Endpoint(winAppDriverBase, "status"),
                appiumExecutable,
                StringArray(payload, "appiumArguments", "appium_arguments"),
                driverExecutable,
                StringArray(payload, "winAppDriverArguments", "win_app_driver_arguments"),
                applicationPath,
                StringArray(payload, "applicationArguments", "application_arguments"),
                workingDirectory,
                environment,
                Boolean(payload, false, "launchApplication", "launch_application"),
                Boolean(payload, true, "requireApplicationWindow", "require_application_window"),
                Seconds(payload, 45, 5, 180, "startupTimeoutSeconds", "startup_timeout_seconds"),
                Seconds(payload, 45, 5, 180, "applicationTimeoutSeconds", "application_timeout_seconds"),
                Seconds(payload, 30, 5, 120, "sessionTimeoutSeconds", "session_timeout_seconds"),
                Seconds(payload, 120, 10, 300, "recoveryTimeoutSeconds", "recovery_timeout_seconds"),
                Integer(payload, 120, 30, 3600, "newCommandTimeoutSeconds", "new_command_timeout_seconds"));
        }

        public object BuildW3cCapabilities() => new
        {
            capabilities = new
            {
                alwaysMatch = new Dictionary<string, object?>
                {
                    ["platformName"] = "Windows",
                    ["appium:automationName"] = "Windows",
                    ["appium:app"] = ApplicationPath,
                    ["appium:deviceName"] = "WindowsPC",
                    ["appium:newCommandTimeout"] = NewCommandTimeoutSeconds
                }
            }
        };

        private static Uri LoopbackUri(string value, string name)
        {
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
                uri.Scheme is not ("http" or "https") ||
                !(uri.IsLoopback || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException($"{name} URL must be an absolute loopback HTTP(S) URL.");
            return uri;
        }

        private static Uri Endpoint(Uri baseUri, string segment)
        {
            var text = baseUri.ToString().TrimEnd('/') + "/" + segment.TrimStart('/');
            return new Uri(text, UriKind.Absolute);
        }

        private static string? FullPathOrNull(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            if (!Path.IsPathFullyQualified(value) || ContainsTraversal(value))
                throw new InvalidOperationException(ErrorCode.INVALID_RUNTIME_CONFIGURATION.ToString());
            return Path.GetFullPath(value);
        }

        private static bool ContainsTraversal(string value) =>
            value.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(segment => segment == "..");

        private static IReadOnlyDictionary<string, string> ParseEnvironment(JsonElement payload)
        {
            var output = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var element = Property(payload, "environment", "environmentVariables", "environment_variables");
            if (element is not { ValueKind: JsonValueKind.Object }) return output;
            foreach (var property in element.Value.EnumerateObject())
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(property.Name, "^[A-Za-z_][A-Za-z0-9_]{0,127}$"))
                    throw new InvalidOperationException(ErrorCode.INVALID_RUNTIME_CONFIGURATION.ToString());
                if (property.Value.ValueKind != JsonValueKind.String) continue;
                output[property.Name] = property.Value.GetString() ?? string.Empty;
            }
            return output;
        }

        private static TimeSpan Seconds(JsonElement payload, int fallback, int minimum, int maximum, params string[] names) =>
            TimeSpan.FromSeconds(Integer(payload, fallback, minimum, maximum, names));

        private static int Integer(JsonElement payload, int fallback, int minimum, int maximum, params string[] names)
        {
            var value = Property(payload, names);
            if (value is null) return fallback;
            if (value.Value.ValueKind == JsonValueKind.Number && value.Value.TryGetInt32(out var number))
                return Math.Clamp(number, minimum, maximum);
            return fallback;
        }

        private static bool Boolean(JsonElement payload, bool fallback, params string[] names)
        {
            var value = Property(payload, names);
            return value is { ValueKind: JsonValueKind.True } || value is { ValueKind: JsonValueKind.False }
                ? value.Value.GetBoolean()
                : fallback;
        }

        private static IReadOnlyList<string> StringArray(JsonElement payload, params string[] names)
        {
            var value = Property(payload, names);
            if (value is not { ValueKind: JsonValueKind.Array }) return Array.Empty<string>();
            return value.Value.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.String)
                .Select(item => item.GetString() ?? string.Empty)
                .Where(item => item.Length <= 4096)
                .Take(128)
                .ToArray();
        }

        private static string? String(JsonElement payload, params string[] names)
        {
            var value = Property(payload, names);
            return value is { ValueKind: JsonValueKind.String } ? value.Value.GetString() : null;
        }

        private static JsonElement? Property(JsonElement payload, params string[] names)
        {
            if (payload.ValueKind != JsonValueKind.Object) return null;
            foreach (var name in names)
                if (payload.TryGetProperty(name, out var value)) return value;
            return null;
        }
    }
}
