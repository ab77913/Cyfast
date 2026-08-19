using System.Collections.Frozen;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CyFast.Windows.Contracts;

public static class CommandTypes
{
    public const string Health = "windows.health";
    public const string GetCapabilities = "windows.get_capabilities";
    public const string StartSession = "windows.start_session";
    public const string EndSession = "windows.end_session";
    public const string LaunchProfile = "windows.launch_profile";
    public const string AttachProfile = "windows.attach_profile";
    public const string InspectUi = "windows.inspect_ui";
    public const string CaptureScreenshot = "windows.capture_screenshot";
    public const string InvokeElement = "windows.invoke_element";
    public const string SetElementValue = "windows.set_element_value";
    public const string SelectElement = "windows.select_element";
    public const string CloseApplication = "windows.close_application";

    public const string CheckRuntime = "windows.check_runtime";
    public const string RecoverRuntime = "windows.recover_runtime";
    public const string ValidateRobotPackage = "windows.validate_robot_package";
    public const string StartRobotJob = "windows.start_robot_job";
    public const string GetRobotJobStatus = "windows.get_robot_job_status";
    public const string CancelRobotJob = "windows.cancel_robot_job";
    public const string CollectRobotJobResult = "windows.collect_robot_job_result";

    public static readonly FrozenSet<string> Allowed = new[]
    {
        Health, GetCapabilities, StartSession, EndSession,
        LaunchProfile, AttachProfile, InspectUi, CaptureScreenshot,
        InvokeElement, SetElementValue, SelectElement, CloseApplication,
        CheckRuntime, RecoverRuntime, ValidateRobotPackage, StartRobotJob,
        GetRobotJobStatus, CancelRobotJob, CollectRobotJobResult
    }.ToFrozenSet(StringComparer.Ordinal);

    public static bool IsAllowed(string commandType) => Allowed.Contains(commandType);

    public static TimeSpan IpcTimeout(string commandType) => commandType switch
    {
        RecoverRuntime => TimeSpan.FromMinutes(3),
        StartRobotJob => TimeSpan.FromSeconds(45),
        CollectRobotJobResult => TimeSpan.FromMinutes(2),
        ValidateRobotPackage => TimeSpan.FromSeconds(45),
        _ => TimeSpan.FromSeconds(35)
    };
}

public enum ErrorCode
{
    None = 0,
    NO_INTERACTIVE_SESSION,
    SESSION_LOCKED,
    SESSION_DISCONNECTED,
    SESSION_LOGGING_OFF,
    APPLICATION_NOT_FOUND,
    APPLICATION_NOT_APPROVED,
    APPLICATION_HASH_MISMATCH,
    PROCESS_NOT_FOUND,
    WINDOW_NOT_FOUND,
    ELEMENT_NOT_FOUND,
    ELEMENT_NOT_INTERACTABLE,
    UIA_TIMEOUT,
    SCREENSHOT_FAILED,
    COMMAND_EXPIRED,
    COMMAND_REJECTED,
    PERMISSION_DENIED,
    AGENT_BUSY,
    INTERNAL_ERROR,

    WINDOWS_RUNTIME_UNAVAILABLE,
    INTERACTIVE_SESSION_UNAVAILABLE,
    INTERACTIVE_SESSION_LOCKED,
    BOOTSTRAP_NOT_READY,
    AGENT_NOT_READY,
    APPIUM_START_FAILED,
    APPIUM_STATUS_FAILED,
    WINAPPDRIVER_NOT_FOUND,
    WINAPPDRIVER_START_FAILED,
    DRIVER_SESSION_FAILED,
    APPLICATION_PATH_NOT_FOUND,
    APPLICATION_LAUNCH_FAILED,
    APPLICATION_PROCESS_NOT_FOUND,
    APPLICATION_WINDOW_NOT_FOUND,
    RUNTIME_RECOVERY_TIMEOUT,
    INVALID_RUNTIME_CONFIGURATION,
    PACKAGE_VALIDATION_FAILED,
    SCRIPT_DEFECT,
    KEYWORD_IMPORT_DEFECT,
    ROBOT_EXECUTION_FAILED,
    LOCATOR_FAILURE,
    ASSERTION_FAILURE,
    EXECUTION_TIMEOUT,
    EXECUTION_CANCELLED,
    ARTIFACT_UPLOAD_FAILED,
    UNAUTHORIZED,

    InvalidSchema = COMMAND_REJECTED,
    UnsupportedCommand = COMMAND_REJECTED,
    ExpiredCommand = COMMAND_EXPIRED,
    DuplicateCommand = COMMAND_REJECTED,
    Unauthorized = PERMISSION_DENIED,
    InvalidRequest = COMMAND_REJECTED,
    MessageTooLarge = COMMAND_REJECTED,
    Timeout = UIA_TIMEOUT,
    Cancelled = EXECUTION_CANCELLED,
    NoInteractiveSession = NO_INTERACTIVE_SESSION,
    SessionLocked = SESSION_LOCKED,
    SessionDisconnected = SESSION_DISCONNECTED,
    SessionLoggingOff = SESSION_LOGGING_OFF,
    InvalidProfile = APPLICATION_NOT_APPROVED,
    ProfileHashMismatch = APPLICATION_HASH_MISMATCH,
    ElementNotFound = ELEMENT_NOT_FOUND,
    AutomationFailed = INTERNAL_ERROR,
    NotSupported = COMMAND_REJECTED,
    TransportUnavailable = INTERNAL_ERROR,
    Internal = INTERNAL_ERROR
}

public enum SessionState
{
    OFFLINE,
    ENROLLING,
    ONLINE,
    NO_INTERACTIVE_SESSION,
    SESSION_LOCKED,
    SESSION_DISCONNECTED,
    SESSION_LOGGING_OFF,
    READY,
    BUSY,
    DEGRADED,
    UPDATING,
    REVOKED
}

public sealed record CommandEnvelope(
    string SchemaVersion,
    string MessageId,
    string CommandType,
    string OrganizationId,
    string ProjectId,
    string ResourceId,
    string? SessionId,
    string CorrelationId,
    string IdempotencyKey,
    DateTimeOffset IssuedAt,
    DateTimeOffset ExpiresAt,
    JsonElement Principal,
    JsonElement Payload,
    string PayloadHash)
{
    // Compatibility constructor for local callers created before the W1 envelope expanded.
    public CommandEnvelope(
        string schemaVersion,
        string requestId,
        string commandType,
        DateTimeOffset expiresAt,
        string idempotencyKey,
        JsonElement payload,
        string? sessionId = null)
        : this(
            schemaVersion,
            requestId,
            commandType,
            "",
            "",
            "",
            sessionId,
            requestId,
            idempotencyKey,
            DateTimeOffset.UtcNow,
            expiresAt,
            JsonDocument.Parse("{}").RootElement.Clone(),
            payload,
            "")
    {
    }

    public string RequestId => MessageId;
}

public sealed record CommandResult(
    string RequestId,
    bool Success,
    ErrorCode ErrorCode = ErrorCode.None,
    string? Message = null,
    JsonElement? Payload = null,
    EvidenceMetadata? Evidence = null);

public sealed record UiElement(
    string AutomationId,
    string Name,
    string ControlType,
    string? Value,
    bool IsEnabled,
    bool IsOffscreen,
    IReadOnlyList<SelectorCandidate> Selectors,
    IReadOnlyList<UiElement>? Children = null);

public sealed record UiSnapshot(UiElement Root, DateTimeOffset CapturedAt, bool IsTruncated);
public sealed record SelectorCandidate(string Strategy, string Value, double StabilityScore);
public sealed record EvidenceMetadata(string Sha256, string ContentType, long Length, DateTimeOffset CreatedAt);

public sealed record ApplicationProfile(
    string Id,
    string ExecutablePath,
    string? Arguments = null,
    string? Sha256 = null,
    bool AllowUncPaths = false);

public sealed record RuntimeComponentStatus(
    bool Ready,
    string? Endpoint = null,
    int? ProcessId = null,
    bool StartedByCyFast = false,
    DateTimeOffset? LastVerifiedAt = null,
    string? ErrorCode = null,
    string? Message = null);

public sealed record RuntimeApplicationStatus(
    bool PathExists,
    bool ProcessRunning,
    bool WindowFound,
    string? ExecutablePath,
    int? ProcessId = null,
    string? WindowTitle = null);

public sealed record RuntimeSessionProof(
    bool Ready,
    bool SessionCreated,
    string? SessionId,
    string? AppiumUrl,
    JsonElement? EffectiveCapabilities,
    DateTimeOffset? LastVerifiedAt,
    string? ErrorCode = null,
    string? Message = null);

public sealed record WindowsRuntimeStatus(
    bool Ready,
    bool RealExecution,
    bool Simulated,
    bool DesktopExecution,
    string RuntimeOs,
    SessionState InteractiveSession,
    RuntimeComponentStatus Agent,
    RuntimeComponentStatus Appium,
    RuntimeComponentStatus WinAppDriver,
    RuntimeApplicationStatus Application,
    RuntimeSessionProof DriverSession,
    IReadOnlyList<string> Errors,
    DateTimeOffset CheckedAt);

public sealed record RobotPackageFile(string Path, string ContentBase64, string? Sha256 = null);

public sealed record RobotPackageRequest(
    string ExecutionId,
    IReadOnlyList<RobotPackageFile> Files,
    string? SuitePath = null,
    int TimeoutSeconds = 900,
    IReadOnlyDictionary<string, string>? Environment = null,
    IReadOnlyDictionary<string, string>? EnvironmentReferences = null,
    int MaxPackageBytes = 225_280,
    bool AllowCoordinateAutomation = false);

public sealed record RobotPackageValidationResult(
    bool Valid,
    string? SuitePath,
    long PackageBytes,
    int MeaningfulActions,
    int MeaningfulAssertions,
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Warnings);

public sealed record RobotArtifact(
    string Type,
    string FileName,
    string ContentType,
    long Size,
    string Sha256,
    string ContentBase64);

public sealed record RobotJobStatus(
    string JobId,
    string ExecutionId,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    int? RobotExitCode,
    string? FailureClassification,
    string? FailureMessage);

public sealed record RobotJobResult(
    string JobId,
    string ExecutionId,
    string Status,
    bool RealExecution,
    bool Simulated,
    bool DesktopExecution,
    string RuntimeOs,
    string Host,
    string? AppiumUrl,
    string? ApplicationPath,
    string? RuntimeProofSessionId,
    DateTimeOffset? RuntimeProofVerifiedAt,
    bool SessionCreated,
    int? RobotExitCode,
    int MeaningfulActions,
    int MeaningfulAssertions,
    DateTimeOffset StartedAt,
    DateTimeOffset FinishedAt,
    long DurationMs,
    string Stdout,
    string Stderr,
    string? FailureClassification,
    string? FailureMessage,
    IReadOnlyList<RobotArtifact> Artifacts);

public sealed record IpcRequest(string RequestId, string Action, JsonElement Payload, int TimeoutMs);
public sealed record IpcResponse(string RequestId, bool Success, ErrorCode ErrorCode, string? Message, JsonElement? Payload);

[JsonSerializable(typeof(CommandEnvelope))]
[JsonSerializable(typeof(CommandResult))]
[JsonSerializable(typeof(IpcRequest))]
[JsonSerializable(typeof(IpcResponse))]
[JsonSerializable(typeof(WindowsRuntimeStatus))]
[JsonSerializable(typeof(RobotPackageRequest))]
[JsonSerializable(typeof(RobotPackageValidationResult))]
[JsonSerializable(typeof(RobotJobStatus))]
[JsonSerializable(typeof(RobotJobResult))]
public partial class ContractsJsonContext : JsonSerializerContext;
