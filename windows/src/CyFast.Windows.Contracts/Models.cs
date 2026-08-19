using System.Collections.Frozen;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CyFast.Windows.Contracts;

public static class CommandTypes
{
    public static readonly FrozenSet<string> Allowed = new[]
    {
        "windows.health", "windows.get_capabilities", "windows.start_session", "windows.end_session",
        "windows.launch_profile", "windows.attach_profile", "windows.inspect_ui", "windows.capture_screenshot",
        "windows.invoke_element", "windows.set_element_value", "windows.select_element", "windows.close_application"
    }.ToFrozenSet(StringComparer.Ordinal);

    public static bool IsAllowed(string commandType) => Allowed.Contains(commandType);
}

public enum ErrorCode
{
    None = 0,
    NO_INTERACTIVE_SESSION, SESSION_LOCKED, SESSION_DISCONNECTED, SESSION_LOGGING_OFF,
    APPLICATION_NOT_FOUND, APPLICATION_NOT_APPROVED,
    APPLICATION_HASH_MISMATCH, PROCESS_NOT_FOUND, WINDOW_NOT_FOUND, ELEMENT_NOT_FOUND,
    ELEMENT_NOT_INTERACTABLE, UIA_TIMEOUT, SCREENSHOT_FAILED, COMMAND_EXPIRED,
    COMMAND_REJECTED, PERMISSION_DENIED, AGENT_BUSY, INTERNAL_ERROR,
    InvalidSchema = COMMAND_REJECTED, UnsupportedCommand = COMMAND_REJECTED,
    ExpiredCommand = COMMAND_EXPIRED, DuplicateCommand = COMMAND_REJECTED,
    Unauthorized = PERMISSION_DENIED, InvalidRequest = COMMAND_REJECTED,
    MessageTooLarge = COMMAND_REJECTED, Timeout = UIA_TIMEOUT, Cancelled = COMMAND_REJECTED,
    NoInteractiveSession = NO_INTERACTIVE_SESSION, SessionLocked = SESSION_LOCKED,
    SessionDisconnected = SESSION_DISCONNECTED, SessionLoggingOff = SESSION_LOGGING_OFF,
    InvalidProfile = APPLICATION_NOT_APPROVED, ProfileHashMismatch = APPLICATION_HASH_MISMATCH,
    ElementNotFound = ELEMENT_NOT_FOUND, AutomationFailed = INTERNAL_ERROR,
    NotSupported = COMMAND_REJECTED, TransportUnavailable = INTERNAL_ERROR, Internal = INTERNAL_ERROR
}

public enum SessionState
{
    OFFLINE, ENROLLING, ONLINE, NO_INTERACTIVE_SESSION, SESSION_LOCKED, SESSION_DISCONNECTED,
    SESSION_LOGGING_OFF, READY, BUSY, DEGRADED, UPDATING, REVOKED
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
    public CommandEnvelope(string schemaVersion, string requestId, string commandType, DateTimeOffset expiresAt,
        string idempotencyKey, JsonElement payload, string? sessionId = null)
        : this(schemaVersion, requestId, commandType, "", "", "", sessionId, requestId, idempotencyKey,
            DateTimeOffset.UtcNow, expiresAt, JsonDocument.Parse("{}").RootElement.Clone(), payload, "") { }

    public string RequestId => MessageId;
}

public sealed record CommandResult(
    string RequestId, bool Success, ErrorCode ErrorCode = ErrorCode.None,
    string? Message = null, JsonElement? Payload = null, EvidenceMetadata? Evidence = null);

public sealed record UiElement(
    string AutomationId, string Name, string ControlType, string? Value,
    bool IsEnabled, bool IsOffscreen, IReadOnlyList<SelectorCandidate> Selectors,
    IReadOnlyList<UiElement>? Children = null);

public sealed record UiSnapshot(UiElement Root, DateTimeOffset CapturedAt, bool IsTruncated);
public sealed record SelectorCandidate(string Strategy, string Value, double StabilityScore);
public sealed record EvidenceMetadata(string Sha256, string ContentType, long Length, DateTimeOffset CreatedAt);

public sealed record ApplicationProfile(
    string Id, string ExecutablePath, string? Arguments = null, string? Sha256 = null,
    bool AllowUncPaths = false);

public sealed record IpcRequest(string RequestId, string Action, JsonElement Payload, int TimeoutMs);
public sealed record IpcResponse(string RequestId, bool Success, ErrorCode ErrorCode, string? Message, JsonElement? Payload);

[JsonSerializable(typeof(CommandEnvelope))]
[JsonSerializable(typeof(CommandResult))]
[JsonSerializable(typeof(IpcRequest))]
[JsonSerializable(typeof(IpcResponse))]
public partial class ContractsJsonContext : JsonSerializerContext;
