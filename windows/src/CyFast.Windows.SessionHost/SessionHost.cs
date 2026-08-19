using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Diagnostics;
using System.Text.Json;
using CyFast.Windows.Contracts;
using CyFast.Windows.Uia;

namespace CyFast.Windows.SessionHost;

public sealed class SessionHost
{
    public string GetHealth() => DesktopState.GetError() == ErrorCode.None ? "healthy" : "unavailable";

    private readonly IUiAutomationBackend _automation;
    private Process? _application;
    private string? _sessionId;

    public SessionHost(IUiAutomationBackend? automation = null) => _automation = automation ?? new FlaUi3Backend();

    public async Task<IpcResponse> HandleAsync(IpcRequest request, CancellationToken cancellationToken)
    {
        var desktopError = DesktopState.GetError();
        if (desktopError != ErrorCode.None && request.Action != "windows.health")
            return Failure(request, desktopError, desktopError.ToString());

        try
        {
            return request.Action switch
            {
                "windows.health" => Success(request, new { status = GetHealth(), state = DesktopState.GetSessionState() }),
                "windows.get_capabilities" => Success(request, new { commands = CommandTypes.Allowed.Order(), uia = true, screenshots = true }),
                "windows.start_session" => StartSession(request),
                "windows.end_session" => EndSession(request),
                "windows.launch_profile" => Launch(request),
                "windows.attach_profile" => Attach(request),
                "windows.inspect_ui" => Success(request, await InspectUiAsync(cancellationToken).ConfigureAwait(false)),
                "windows.capture_screenshot" => Screenshot(request, await CaptureScreenshotAsync(cancellationToken).ConfigureAwait(false)),
                "windows.invoke_element" => await Invoke(request, cancellationToken).ConfigureAwait(false),
                "windows.set_element_value" => await SetValue(request, cancellationToken).ConfigureAwait(false),
                "windows.select_element" => await Select(request, cancellationToken).ConfigureAwait(false),
                "windows.close_application" => CloseApplication(request),
                _ => Failure(request, ErrorCode.COMMAND_REJECTED, "Unknown action.")
            };
        }
        catch (TimeoutException exception) { return Failure(request, ErrorCode.UIA_TIMEOUT, exception.Message); }
        catch (InvalidOperationException exception) { return Failure(request, MapAutomationError(exception.Message), exception.Message); }
        catch (Exception exception) { return Failure(request, ErrorCode.INTERNAL_ERROR, exception.Message); }
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

    private IpcResponse Launch(IpcRequest request)
    {
        var profile = request.Payload.Deserialize<ApplicationProfile>() ?? throw new InvalidOperationException("APPLICATION_NOT_APPROVED");
        var validation = ProfileValidator.Validate(profile);
        if (validation != ErrorCode.None) return Failure(request, validation, validation.ToString());
        _application = Process.Start(new ProcessStartInfo(profile.ExecutablePath, profile.Arguments ?? "") { UseShellExecute = false })
            ?? throw new InvalidOperationException("APPLICATION_NOT_FOUND");
        return Success(request, new { processId = _application.Id, profileId = profile.Id });
    }

    private IpcResponse Attach(IpcRequest request)
    {
        var name = GetString(request.Payload, "processName");
        var title = GetString(request.Payload, "windowTitle");
        var process = !string.IsNullOrWhiteSpace(name)
            ? Process.GetProcessesByName(Path.GetFileNameWithoutExtension(name)).FirstOrDefault()
            : Process.GetProcesses().FirstOrDefault(p => SafeMainWindowTitle(p).Contains(title ?? "", StringComparison.OrdinalIgnoreCase));
        if (process is null) return Failure(request, string.IsNullOrWhiteSpace(name) ? ErrorCode.WINDOW_NOT_FOUND : ErrorCode.PROCESS_NOT_FOUND, "Application was not found.");
        _application = process;
        return Success(request, new { processId = process.Id, windowTitle = SafeMainWindowTitle(process) });
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
        Success(request, new { contentType = "image/png", data = Convert.ToBase64String(bytes), sha256 = Convert.ToHexString(SHA256.HashData(bytes)) });
    private IpcResponse CloseApplication(IpcRequest request)
    {
        if (_application is null || _application.HasExited) return Failure(request, ErrorCode.PROCESS_NOT_FOUND, "No attached application.");
        _application.CloseMainWindow();
        return Success(request, new { processId = _application.Id, closed = true });
    }
    private static IpcResponse Success(IpcRequest request, object payload) => new(request.RequestId, true, ErrorCode.None, null, JsonSerializer.SerializeToElement(payload));
    private static IpcResponse Failure(IpcRequest request, ErrorCode code, string message) => new(request.RequestId, false, code, message, null);
    private static string Selector(IpcRequest request) => GetString(request.Payload, "automationId") ?? throw new InvalidOperationException("ELEMENT_NOT_FOUND");
    private static string? GetString(JsonElement payload, string property) => payload.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static string SafeMainWindowTitle(Process process) { try { return process.MainWindowTitle; } catch { return ""; } }
    private static ErrorCode MapAutomationError(string message) =>
        message.StartsWith("ELEMENT_NOT_FOUND", StringComparison.Ordinal) ? ErrorCode.ELEMENT_NOT_FOUND :
        message.StartsWith("ELEMENT_NOT_INTERACTABLE", StringComparison.Ordinal) ? ErrorCode.ELEMENT_NOT_INTERACTABLE :
        message.StartsWith("PROCESS_NOT_FOUND", StringComparison.Ordinal) ? ErrorCode.PROCESS_NOT_FOUND :
        message.StartsWith("WINDOW_NOT_FOUND", StringComparison.Ordinal) ? ErrorCode.WINDOW_NOT_FOUND :
        message.StartsWith("SCREENSHOT_FAILED", StringComparison.Ordinal) ? ErrorCode.SCREENSHOT_FAILED : ErrorCode.INTERNAL_ERROR;
}

public static class DesktopState
{
    private const int WTSActive = 0;
    private const int WTSConnected = 1;
    private const int WTSConnectQuery = 2;
    private const int WTSShadow = 3;
    private const int WTSDisconnected = 4;
    private const int WTSIdle = 5;
    private const int WTSListen = 6;
    private const int WTSReset = 7;
    private const int WTSDown = 8;
    private const int WTSInit = 9;

    public static ErrorCode GetError()
    {
        if (!Environment.UserInteractive) return ErrorCode.NoInteractiveSession;
        if (!OperatingSystem.IsWindows()) return ErrorCode.NoInteractiveSession;

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
            try
            {
                return Marshal.ReadInt32(buffer);
            }
            finally
            {
                WTSFreeMemory(buffer);
            }
        }
        return WTSActive;
    }

    private enum WTS_INFO_CLASS
    {
        WTSConnectState = 8
    }

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
        var fullPath = Path.GetFullPath(profile.ExecutablePath);
        if (!Path.IsPathFullyQualified(profile.ExecutablePath) || profile.ExecutablePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(segment => segment == "..")) return ErrorCode.InvalidProfile;
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
