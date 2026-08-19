using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using CyFast.Windows.Contracts;
using CyFast.Windows.Uia;

namespace CyFast.Windows.SessionHost;

public sealed class SessionHost : IDisposable
{
    private static readonly HashSet<string> DesktopIndependentCommands = new(StringComparer.Ordinal)
    {
        CommandTypes.Health,
        CommandTypes.GetCapabilities,
        CommandTypes.CheckRuntime,
        CommandTypes.RecoverRuntime,
        CommandTypes.ValidateRobotPackage,
        CommandTypes.GetRobotJobStatus,
        CommandTypes.CancelRobotJob,
        CommandTypes.CollectRobotJobResult
    };

    private readonly IUiAutomationBackend _automation;
    private readonly WindowsRuntimeSupervisor _runtimeSupervisor;
    private readonly RobotJobManager _robotJobs;
    private readonly bool _ownsRuntimeSupervisor;
    private readonly bool _ownsRobotJobs;
    private Process? _application;
    private bool _applicationOwned;
    private string? _sessionId;
    private WindowsRuntimeStatus? _lastRuntimeStatus;

    public SessionHost(
        IUiAutomationBackend? automation = null,
        WindowsRuntimeSupervisor? runtimeSupervisor = null,
        RobotJobManager? robotJobs = null)
    {
        _automation = automation ?? new FlaUi3Backend();
        _runtimeSupervisor = runtimeSupervisor ?? new WindowsRuntimeSupervisor();
        _ownsRuntimeSupervisor = runtimeSupervisor is null;
        _robotJobs = robotJobs ?? new RobotJobManager(runtimeStatusProvider: () => Volatile.Read(ref _lastRuntimeStatus));
        _ownsRobotJobs = robotJobs is null;
    }

    public string GetHealth() => DesktopState.GetError() == ErrorCode.None ? "healthy" : "unavailable";

    public async Task<IpcResponse> HandleAsync(IpcRequest request, CancellationToken cancellationToken)
    {
        var desktopError = DesktopState.GetError();
        if (desktopError != ErrorCode.None && !DesktopIndependentCommands.Contains(request.Action))
            return Failure(request, desktopError, desktopError.ToString());

        try
        {
            return request.Action switch
            {
                CommandTypes.Health => Success(request, new
                {
                    status = GetHealth(),
                    state = DesktopState.GetSessionState(),
                    realExecution = true,
                    simulated = false,
                    desktopExecution = true,
                    runtimeVerified = _lastRuntimeStatus?.Ready == true,
                    checkedAt = _lastRuntimeStatus?.CheckedAt
                }),
                CommandTypes.GetCapabilities => Success(request, new
                {
                    commands = CommandTypes.Allowed.Order(),
                    uia = true,
                    screenshots = true,
                    runtimeRecovery = true,
                    robotJobs = true,
                    maxRobotPackageBytes = RobotJobManager.HardPackageLimitBytes,
                    arbitraryShell = false
                }),
                CommandTypes.StartSession => StartSession(request),
                CommandTypes.EndSession => EndSession(request),
                CommandTypes.LaunchProfile => await LaunchAsync(request, cancellationToken).ConfigureAwait(false),
                CommandTypes.AttachProfile => Attach(request),
                CommandTypes.InspectUi => Success(request, await InspectUiAsync(cancellationToken).ConfigureAwait(false)),
                CommandTypes.CaptureScreenshot => Screenshot(request, await CaptureScreenshotAsync(cancellationToken).ConfigureAwait(false)),
                CommandTypes.InvokeElement => await Invoke(request, cancellationToken).ConfigureAwait(false),
                CommandTypes.SetElementValue => await SetValue(request, cancellationToken).ConfigureAwait(false),
                CommandTypes.SelectElement => await Select(request, cancellationToken).ConfigureAwait(false),
                CommandTypes.CloseApplication => await CloseApplicationAsync(request, cancellationToken).ConfigureAwait(false),
                CommandTypes.CheckRuntime => await CheckRuntimeAsync(request, cancellationToken).ConfigureAwait(false),
                CommandTypes.RecoverRuntime => await RecoverRuntimeAsync(request, cancellationToken).ConfigureAwait(false),
                CommandTypes.ValidateRobotPackage => Success(request, _robotJobs.Validate(request.Payload)),
                CommandTypes.StartRobotJob => Success(request, await _robotJobs.StartAsync(request.Payload, cancellationToken).ConfigureAwait(false)),
                CommandTypes.GetRobotJobStatus => Success(request, _robotJobs.GetStatus(request.Payload)),
                CommandTypes.CancelRobotJob => Success(request, await _robotJobs.CancelAsync(request.Payload, cancellationToken).ConfigureAwait(false)),
                CommandTypes.CollectRobotJobResult => Success(request, await _robotJobs.CollectAsync(request.Payload, cancellationToken).ConfigureAwait(false)),
                _ => Failure(request, ErrorCode.COMMAND_REJECTED, "Unknown action.")
            };
        }
        catch (RobotPackageException exception)
        {
            return Failure(request, exception.Code, exception.Message);
        }
        catch (TimeoutException exception)
        {
            return Failure(request, ErrorCode.UIA_TIMEOUT, exception.Message);
        }
        catch (InvalidOperationException exception)
        {
            return Failure(request, MapAutomationError(exception.Message), exception.Message);
        }
        catch (FileNotFoundException exception)
        {
            return Failure(request, ErrorCode.APPLICATION_PATH_NOT_FOUND, exception.Message);
        }
        catch (InvalidDataException exception)
        {
            return Failure(request, ErrorCode.PACKAGE_VALIDATION_FAILED, exception.Message);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return Failure(request, ErrorCode.EXECUTION_CANCELLED, "Command was cancelled.");
        }
        catch (Exception exception)
        {
            return Failure(request, ErrorCode.INTERNAL_ERROR, Bounded(exception.Message, 4096));
        }
    }

    private IpcResponse StartSession(IpcRequest request)
    {
        _sessionId = Guid.NewGuid().ToString("N");
        return Success(request, new { sessionId = _sessionId, state = SessionState.READY });
    }

    private IpcResponse EndSession(IpcRequest request)
    {
        _sessionId = null;
        return Success(request, new { state = SessionState.ONLINE });
    }

    private async Task<IpcResponse> CheckRuntimeAsync(IpcRequest request, CancellationToken cancellationToken)
    {
        var status = await _runtimeSupervisor.CheckAsync(request.Payload, cancellationToken).ConfigureAwait(false);
        Volatile.Write(ref _lastRuntimeStatus, status);
        return Success(request, status);
    }

    private async Task<IpcResponse> RecoverRuntimeAsync(IpcRequest request, CancellationToken cancellationToken)
    {
        var status = await _runtimeSupervisor.RecoverAsync(request.Payload, cancellationToken).ConfigureAwait(false);
        Volatile.Write(ref _lastRuntimeStatus, status);
        return Success(request, status);
    }

    private async Task<IpcResponse> LaunchAsync(IpcRequest request, CancellationToken cancellationToken)
    {
        var profile = JsonSerializer.Deserialize<LaunchProfileRequest>(request.Payload.GetRawText(), JsonOptions)
            ?? throw new InvalidOperationException(ErrorCode.APPLICATION_NOT_APPROVED.ToString());
        var validation = ValidateLaunchProfile(profile);
        if (validation != ErrorCode.None) return Failure(request, validation, validation.ToString());

        if (_application is { HasExited: false } &&
            string.Equals(SafeExecutablePath(_application), Path.GetFullPath(profile.ExecutablePath), StringComparison.OrdinalIgnoreCase))
            return Success(request, new { processId = _application.Id, profileId = profile.Id, reused = true, windowFound = HasTopLevelWindow(_application) });

        var startInfo = new ProcessStartInfo
        {
            FileName = Path.GetFullPath(profile.ExecutablePath),
            WorkingDirectory = string.IsNullOrWhiteSpace(profile.WorkingDirectory)
                ? Path.GetDirectoryName(Path.GetFullPath(profile.ExecutablePath))!
                : Path.GetFullPath(profile.WorkingDirectory),
            UseShellExecute = false
        };
        foreach (var argument in profile.ArgumentList ?? Array.Empty<string>())
            startInfo.ArgumentList.Add(argument);
        foreach (var pair in profile.Environment ?? new Dictionary<string, string>())
        {
            ValidateEnvironmentName(pair.Key);
            startInfo.Environment[pair.Key] = pair.Value;
        }
        foreach (var pair in profile.EnvironmentReferences ?? new Dictionary<string, string>())
        {
            ValidateEnvironmentName(pair.Key);
            ValidateEnvironmentName(pair.Value);
            startInfo.Environment[pair.Key] = Environment.GetEnvironmentVariable(pair.Value)
                ?? throw new InvalidOperationException($"Required local environment reference is unavailable: {pair.Value}");
        }

        _application = Process.Start(startInfo)
            ?? throw new InvalidOperationException(ErrorCode.APPLICATION_LAUNCH_FAILED.ToString());
        _applicationOwned = true;

        var timeoutSeconds = Math.Clamp(profile.StartupTimeoutSeconds, 5, 180);
        var deadline = DateTimeOffset.UtcNow.AddSeconds(timeoutSeconds);
        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (_application.HasExited)
                return Failure(request, ErrorCode.APPLICATION_PROCESS_NOT_FOUND, "Application exited before a top-level window became ready.");
            if (!profile.RequireTopLevelWindow || HasTopLevelWindow(_application))
                return Success(request, new
                {
                    processId = _application.Id,
                    profileId = profile.Id,
                    reused = false,
                    windowFound = HasTopLevelWindow(_application),
                    windowTitle = SafeMainWindowTitle(_application)
                });
            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken).ConfigureAwait(false);
        }

        StopOwnedApplicationAfterFailedLaunch();
        return Failure(request, ErrorCode.APPLICATION_WINDOW_NOT_FOUND, "Application top-level window did not become ready before the bounded timeout.");
    }

    private IpcResponse Attach(IpcRequest request)
    {
        var name = GetString(request.Payload, "processName");
        var title = GetString(request.Payload, "windowTitle");
        if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(title))
            return Failure(request, ErrorCode.InvalidRequest, "processName or windowTitle is required.");

        var process = !string.IsNullOrWhiteSpace(name)
            ? Process.GetProcessesByName(Path.GetFileNameWithoutExtension(name)).FirstOrDefault()
            : Process.GetProcesses().FirstOrDefault(p => SafeMainWindowTitle(p).Contains(title!, StringComparison.OrdinalIgnoreCase));
        if (process is null)
            return Failure(request, string.IsNullOrWhiteSpace(name) ? ErrorCode.WINDOW_NOT_FOUND : ErrorCode.PROCESS_NOT_FOUND, "Application was not found.");
        if (!HasTopLevelWindow(process))
            return Failure(request, ErrorCode.APPLICATION_WINDOW_NOT_FOUND, "Attached process has no ready top-level window.");

        _application = process;
        _applicationOwned = false;
        return Success(request, new { processId = process.Id, windowTitle = SafeMainWindowTitle(process), attached = true });
    }

    private async Task<IpcResponse> Invoke(IpcRequest request, CancellationToken cancellationToken)
    {
        await _automation.InvokeAsync(Selector(request), cancellationToken).ConfigureAwait(false);
        return Success(request, new { invoked = true });
    }

    private async Task<IpcResponse> SetValue(IpcRequest request, CancellationToken cancellationToken)
    {
        await _automation.SetValueAsync(Selector(request), GetString(request.Payload, "value") ?? "", cancellationToken).ConfigureAwait(false);
        return Success(request, new { set = true });
    }

    private async Task<IpcResponse> Select(IpcRequest request, CancellationToken cancellationToken)
    {
        await _automation.SelectAsync(Selector(request), GetString(request.Payload, "value") ?? "", cancellationToken).ConfigureAwait(false);
        return Success(request, new { selected = true });
    }

    private Task<UiSnapshot> InspectUiAsync(CancellationToken cancellationToken) =>
        _application is { HasExited: false }
            ? _automation.InspectProcessAsync(_application.Id, new TraversalOptions(), cancellationToken)
            : _automation.InspectAsync(new TraversalOptions(), cancellationToken);

    private Task<byte[]> CaptureScreenshotAsync(CancellationToken cancellationToken) =>
        _application is { HasExited: false }
            ? _automation.CaptureScreenshotAsync(_application.Id, cancellationToken)
            : _automation.CaptureScreenshotAsync(cancellationToken);

    private IpcResponse Screenshot(IpcRequest request, byte[] bytes) =>
        Success(request, new
        {
            contentType = "image/png",
            data = Convert.ToBase64String(bytes),
            sha256 = Convert.ToHexString(SHA256.HashData(bytes))
        });

    private async Task<IpcResponse> CloseApplicationAsync(IpcRequest request, CancellationToken cancellationToken)
    {
        if (_application is null || _application.HasExited)
            return Failure(request, ErrorCode.PROCESS_NOT_FOUND, "No attached application.");

        var process = _application;
        var owned = _applicationOwned;
        var processId = process.Id;
        process.CloseMainWindow();
        if (owned)
        {
            try
            {
                await process.WaitForExitAsync(cancellationToken).WaitAsync(TimeSpan.FromSeconds(10), cancellationToken).ConfigureAwait(false);
            }
            catch (TimeoutException)
            {
                if (processId != 4 && !process.HasExited) process.Kill(entireProcessTree: true);
            }
        }

        _application = null;
        _applicationOwned = false;
        return Success(request, new { processId, closed = true, cyFastOwned = owned });
    }

    private void StopOwnedApplicationAfterFailedLaunch()
    {
        if (!_applicationOwned || _application is null) return;
        try
        {
            if (_application.Id != 4 && !_application.HasExited) _application.Kill(entireProcessTree: true);
        }
        catch (InvalidOperationException) { }
        catch (System.ComponentModel.Win32Exception) { }
        finally
        {
            _application.Dispose();
            _application = null;
            _applicationOwned = false;
        }
    }

    private static ErrorCode ValidateLaunchProfile(LaunchProfileRequest profile)
    {
        if (string.IsNullOrWhiteSpace(profile.Id) || string.IsNullOrWhiteSpace(profile.ExecutablePath))
            return ErrorCode.APPLICATION_NOT_APPROVED;
        if (!string.IsNullOrWhiteSpace(profile.Arguments))
            return ErrorCode.INVALID_RUNTIME_CONFIGURATION; // list-only arguments are mandatory.
        if (profile.ExecutablePath.StartsWith(@"\\", StringComparison.Ordinal) && !profile.AllowUncPaths)
            return ErrorCode.APPLICATION_NOT_APPROVED;
        if (!Path.IsPathFullyQualified(profile.ExecutablePath) || ContainsTraversal(profile.ExecutablePath))
            return ErrorCode.APPLICATION_NOT_APPROVED;

        var fullPath = Path.GetFullPath(profile.ExecutablePath);
        if (!File.Exists(fullPath)) return ErrorCode.APPLICATION_PATH_NOT_FOUND;
        if (profile.ApprovedExecutableRoots is null || profile.ApprovedExecutableRoots.Count == 0)
            return ErrorCode.APPLICATION_NOT_APPROVED;
        if (!profile.ApprovedExecutableRoots.Any(root => IsWithinRoot(fullPath, root)))
            return ErrorCode.APPLICATION_NOT_APPROVED;
        if (profile.ArgumentList is { Count: > 128 } ||
            profile.ArgumentList?.Any(argument => argument.Length > 4096 || argument.Contains('\0')) == true)
            return ErrorCode.INVALID_RUNTIME_CONFIGURATION;
        if (!string.IsNullOrWhiteSpace(profile.WorkingDirectory) &&
            (!Path.IsPathFullyQualified(profile.WorkingDirectory) || ContainsTraversal(profile.WorkingDirectory) || !Directory.Exists(profile.WorkingDirectory)))
            return ErrorCode.INVALID_RUNTIME_CONFIGURATION;

        if (!string.IsNullOrWhiteSpace(profile.Sha256))
        {
            using var file = File.OpenRead(fullPath);
            var hash = Convert.ToHexString(SHA256.HashData(file));
            if (!hash.Equals(profile.Sha256, StringComparison.OrdinalIgnoreCase))
                return ErrorCode.APPLICATION_HASH_MISMATCH;
        }
        return ErrorCode.None;
    }

    private static bool IsWithinRoot(string path, string root)
    {
        if (string.IsNullOrWhiteSpace(root) || !Path.IsPathFullyQualified(root) || ContainsTraversal(root)) return false;
        var normalizedRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        return path.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase);
    }

    private static bool ContainsTraversal(string value) =>
        value.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(segment => segment == "..");

    private static void ValidateEnvironmentName(string name)
    {
        if (!Regex.IsMatch(name, "^[A-Za-z_][A-Za-z0-9_]{0,127}$"))
            throw new InvalidOperationException(ErrorCode.INVALID_RUNTIME_CONFIGURATION.ToString());
    }

    private static bool HasTopLevelWindow(Process process)
    {
        try
        {
            process.Refresh();
            return process.MainWindowHandle != IntPtr.Zero && !string.IsNullOrWhiteSpace(process.MainWindowTitle);
        }
        catch { return false; }
    }

    private static string? SafeExecutablePath(Process process)
    {
        try { return process.MainModule?.FileName; }
        catch { return null; }
    }

    private static IpcResponse Success(IpcRequest request, object payload) =>
        new(request.RequestId, true, ErrorCode.None, null, JsonSerializer.SerializeToElement(payload));

    private static IpcResponse Failure(IpcRequest request, ErrorCode code, string message) =>
        new(request.RequestId, false, code, Bounded(message, 4096), null);

    private static string Selector(IpcRequest request) =>
        GetString(request.Payload, "automationId") ?? throw new InvalidOperationException("ELEMENT_NOT_FOUND");

    private static string? GetString(JsonElement payload, string property) =>
        payload.ValueKind == JsonValueKind.Object &&
        payload.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static string SafeMainWindowTitle(Process process)
    {
        try { return process.MainWindowTitle; }
        catch { return string.Empty; }
    }

    private static ErrorCode MapAutomationError(string message)
    {
        if (Enum.TryParse<ErrorCode>(message, ignoreCase: false, out var explicitCode)) return explicitCode;
        return message.StartsWith("ELEMENT_NOT_FOUND", StringComparison.Ordinal) ? ErrorCode.ELEMENT_NOT_FOUND :
            message.StartsWith("ELEMENT_NOT_INTERACTABLE", StringComparison.Ordinal) ? ErrorCode.ELEMENT_NOT_INTERACTABLE :
            message.StartsWith("PROCESS_NOT_FOUND", StringComparison.Ordinal) ? ErrorCode.PROCESS_NOT_FOUND :
            message.StartsWith("WINDOW_NOT_FOUND", StringComparison.Ordinal) ? ErrorCode.WINDOW_NOT_FOUND :
            message.StartsWith("SCREENSHOT_FAILED", StringComparison.Ordinal) ? ErrorCode.SCREENSHOT_FAILED :
            ErrorCode.INTERNAL_ERROR;
    }

    private static string Bounded(string value, int maximum) => value.Length <= maximum ? value : value[..maximum];

    public void Dispose()
    {
        if (_applicationOwned) StopOwnedApplicationAfterFailedLaunch();
        else _application?.Dispose();
        if (_ownsRobotJobs) _robotJobs.Dispose();
        if (_ownsRuntimeSupervisor) _runtimeSupervisor.Dispose();
        if (_automation is IDisposable disposable) disposable.Dispose();
    }

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private sealed record LaunchProfileRequest(
        string Id,
        string ExecutablePath,
        string? Arguments = null,
        IReadOnlyList<string>? ArgumentList = null,
        string? Sha256 = null,
        bool AllowUncPaths = false,
        IReadOnlyList<string>? ApprovedExecutableRoots = null,
        string? WorkingDirectory = null,
        IReadOnlyDictionary<string, string>? Environment = null,
        IReadOnlyDictionary<string, string>? EnvironmentReferences = null,
        int StartupTimeoutSeconds = 45,
        bool RequireTopLevelWindow = true);
}

public static class DesktopState
{
    private const int WTSActive = 0;
    private const int WTSDisconnected = 4;
    private const int WTSReset = 7;
    private const int WTSDown = 8;
    private const int WTSInit = 9;

    public static ErrorCode GetError()
    {
        if (!Environment.UserInteractive || !OperatingSystem.IsWindows()) return ErrorCode.NoInteractiveSession;

        var sessionState = GetCurrentSessionConnectState();
        if (sessionState == WTSDisconnected) return ErrorCode.SessionDisconnected;
        if (sessionState is WTSDown or WTSInit or WTSReset) return ErrorCode.NoInteractiveSession;

        var desktop = OpenInputDesktop(0, false, 0x80000000);
        if (desktop == IntPtr.Zero) return ErrorCode.SessionLocked;
        CloseDesktop(desktop);
        return ErrorCode.None;
    }

    public static SessionState GetSessionState()
    {
        var error = GetError();
        return error switch
        {
            ErrorCode.None => SessionState.READY,
            ErrorCode.SessionLocked => SessionState.SESSION_LOCKED,
            ErrorCode.SessionDisconnected => SessionState.SESSION_DISCONNECTED,
            ErrorCode.SessionLoggingOff => SessionState.SESSION_LOGGING_OFF,
            _ => SessionState.NO_INTERACTIVE_SESSION
        };
    }

    private static int GetCurrentSessionConnectState()
    {
        var sessionId = (uint)Process.GetCurrentProcess().SessionId;
        if (WTSQuerySessionInformation(IntPtr.Zero, sessionId, WTS_INFO_CLASS.WTSConnectState, out var buffer, out _) && buffer != IntPtr.Zero)
        {
            try { return Marshal.ReadInt32(buffer); }
            finally { WTSFreeMemory(buffer); }
        }
        return WTSActive;
    }

    private enum WTS_INFO_CLASS { WTSConnectState = 8 }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint desiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSQuerySessionInformation(IntPtr hServer, uint sessionId, WTS_INFO_CLASS wtsInfoClass, out IntPtr ppBuffer, out uint pBytesReturned);
    [DllImport("wtsapi32.dll")]
    private static extern void WTSFreeMemory(IntPtr pointer);
}

public static class ProfileValidator
{
    public static ErrorCode Validate(ApplicationProfile profile)
    {
        if (string.IsNullOrWhiteSpace(profile.ExecutablePath)) return ErrorCode.InvalidProfile;
        if (profile.ExecutablePath.StartsWith(@"\\", StringComparison.Ordinal) && !profile.AllowUncPaths) return ErrorCode.InvalidProfile;
        if (!Path.IsPathFullyQualified(profile.ExecutablePath) ||
            profile.ExecutablePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(segment => segment == ".."))
            return ErrorCode.InvalidProfile;
        var fullPath = Path.GetFullPath(profile.ExecutablePath);
        if (!File.Exists(fullPath)) return ErrorCode.InvalidProfile;
        if (!string.IsNullOrWhiteSpace(profile.Sha256))
        {
            using var file = File.OpenRead(fullPath);
            var hash = Convert.ToHexString(SHA256.HashData(file));
            if (!hash.Equals(profile.Sha256, StringComparison.OrdinalIgnoreCase)) return ErrorCode.ProfileHashMismatch;
        }
        return ErrorCode.None;
    }
}
