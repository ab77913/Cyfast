using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CyFast.Windows.Contracts;
using CyFast.Windows.Ipc;
using Microsoft.Extensions.Options;

namespace CyFast.Windows.Agent;

public sealed class AgentOptions
{
    public Uri ControlPlaneUrl { get; set; } = new("http://127.0.0.1:8088");
    public Uri AgentGatewayUrl { get; set; } = new("ws://127.0.0.1:8094");
    public string Organization { get; set; } = "";
    public string EnrollmentToken { get; set; } = "";
    public string SessionHostPipeName { get; set; } = "CyFast.Windows.SessionHost";
    public int HeartbeatSeconds { get; set; } = 30;
    public bool AllowInsecureLocalTransport { get; set; }
}

public sealed record AgentIdentity(string AgentId, byte[] PrivateKey, byte[] PublicKey);

public interface IIdentityStore
{
    Task SaveAsync(AgentIdentity identity, CancellationToken cancellationToken);
    Task<AgentIdentity?> LoadAsync(CancellationToken cancellationToken);
}

[SupportedOSPlatform("windows")]
public sealed class DpapiIdentityStore : IIdentityStore
{
    private readonly string _path = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "CyFast",
        "identity.bin");

    public async Task SaveAsync(AgentIdentity identity, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        var payload = JsonSerializer.SerializeToUtf8Bytes(identity);
        var protectedPayload = ProtectedData.Protect(payload, null, DataProtectionScope.CurrentUser);
        var temporary = _path + ".tmp";
        await File.WriteAllBytesAsync(temporary, protectedPayload, cancellationToken).ConfigureAwait(false);
        File.Move(temporary, _path, true);
    }

    public async Task<AgentIdentity?> LoadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_path)) return null;
        var protectedPayload = await File.ReadAllBytesAsync(_path, cancellationToken).ConfigureAwait(false);
        var payload = ProtectedData.Unprotect(protectedPayload, null, DataProtectionScope.CurrentUser);
        return JsonSerializer.Deserialize<AgentIdentity>(payload);
    }
}

public sealed class InMemoryIdentityStore : IIdentityStore
{
    private AgentIdentity? _identity;
    public Task SaveAsync(AgentIdentity identity, CancellationToken cancellationToken)
    {
        _identity = identity;
        return Task.CompletedTask;
    }
    public Task<AgentIdentity?> LoadAsync(CancellationToken cancellationToken) => Task.FromResult(_identity);
}

public sealed class CommandValidator
{
    private const int MaxPayloadCharacters = 2 * 1024 * 1024;
    private readonly ConcurrentDictionary<string, DateTimeOffset> _processed = new(StringComparer.Ordinal);

    public ErrorCode Validate(CommandEnvelope command, DateTimeOffset now)
    {
        if (!string.Equals(command.SchemaVersion, "1.0", StringComparison.Ordinal)) return ErrorCode.InvalidSchema;
        if (!CommandTypes.IsAllowed(command.CommandType)) return ErrorCode.UnsupportedCommand;
        if (command.ExpiresAt <= now) return ErrorCode.ExpiredCommand;
        if (command.IssuedAt > now.AddMinutes(5)) return ErrorCode.InvalidRequest;
        if (command.Payload.GetRawText().Length > MaxPayloadCharacters) return ErrorCode.MessageTooLarge;
        if (!string.IsNullOrWhiteSpace(command.PayloadHash) &&
            !command.PayloadHash.Equals(PayloadHash.Compute(command.Payload), StringComparison.OrdinalIgnoreCase))
            return ErrorCode.InvalidRequest;

        Prune(now);
        return _processed.TryAdd(command.IdempotencyKey, command.ExpiresAt)
            ? ErrorCode.None
            : ErrorCode.DuplicateCommand;
    }

    private void Prune(DateTimeOffset now)
    {
        if (_processed.Count < 4096) return;
        foreach (var entry in _processed.Where(entry => entry.Value <= now).Take(1024))
            _processed.TryRemove(entry.Key, out _);
    }
}

public static class PayloadHash
{
    public static string Compute(JsonElement payload)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
            WriteCanonical(writer, payload);
        return Convert.ToHexString(SHA256.HashData(stream.ToArray())).ToLowerInvariant();
    }

    private static void WriteCanonical(Utf8JsonWriter writer, JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                foreach (var property in value.EnumerateObject().OrderBy(property => property.Name, StringComparer.Ordinal))
                {
                    writer.WritePropertyName(property.Name);
                    WriteCanonical(writer, property.Value);
                }
                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in value.EnumerateArray()) WriteCanonical(writer, item);
                writer.WriteEndArray();
                break;
            case JsonValueKind.String:
                writer.WriteStringValue(value.GetString());
                break;
            case JsonValueKind.Number:
                writer.WriteRawValue(value.GetRawText(), skipInputValidation: false);
                break;
            case JsonValueKind.True:
                writer.WriteBooleanValue(true);
                break;
            case JsonValueKind.False:
                writer.WriteBooleanValue(false);
                break;
            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
                writer.WriteNullValue();
                break;
        }
        writer.Flush();
    }
}

public interface IResultSpool
{
    Task EnqueueAsync(CommandResult result, CancellationToken cancellationToken);
    Task<IReadOnlyList<CommandResult>> DrainAsync(CancellationToken cancellationToken);
}

public sealed class InMemoryResultSpool : IResultSpool
{
    private readonly ConcurrentQueue<CommandResult> _results = new();
    public Task EnqueueAsync(CommandResult result, CancellationToken cancellationToken)
    {
        _results.Enqueue(result);
        return Task.CompletedTask;
    }
    public Task<IReadOnlyList<CommandResult>> DrainAsync(CancellationToken cancellationToken)
    {
        var output = new List<CommandResult>();
        while (_results.TryDequeue(out var result)) output.Add(result);
        return Task.FromResult<IReadOnlyList<CommandResult>>(output);
    }
}

public sealed class FileResultSpool : IResultSpool, IDisposable
{
    private readonly string _path;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public FileResultSpool()
    {
        _path = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CyFast",
            "result-spool.json");
    }

    public async Task EnqueueAsync(CommandResult result, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var items = await ReadAsync(cancellationToken).ConfigureAwait(false);
            items.RemoveAll(item => item.RequestId == result.RequestId);
            items.Add(result);
            await WriteAsync(items, cancellationToken).ConfigureAwait(false);
        }
        finally { _gate.Release(); }
    }

    public async Task<IReadOnlyList<CommandResult>> DrainAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var items = await ReadAsync(cancellationToken).ConfigureAwait(false);
            if (File.Exists(_path)) File.Delete(_path);
            return items;
        }
        finally { _gate.Release(); }
    }

    private async Task<List<CommandResult>> ReadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_path)) return new List<CommandResult>();
        try
        {
            await using var stream = File.OpenRead(_path);
            return await JsonSerializer.DeserializeAsync<List<CommandResult>>(stream, cancellationToken: cancellationToken).ConfigureAwait(false)
                ?? new List<CommandResult>();
        }
        catch (JsonException)
        {
            File.Move(_path, _path + ".corrupt-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds(), true);
            return new List<CommandResult>();
        }
    }

    private async Task WriteAsync(List<CommandResult> items, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        var temporary = _path + ".tmp";
        await using (var stream = File.Create(temporary))
            await JsonSerializer.SerializeAsync(stream, items, cancellationToken: cancellationToken).ConfigureAwait(false);
        File.Move(temporary, _path, true);
    }

    public void Dispose() => _gate.Dispose();
}

public static class EvidenceHasher
{
    public static EvidenceMetadata Hash(ReadOnlySpan<byte> data, string contentType) =>
        new(Convert.ToHexString(SHA256.HashData(data)), contentType, data.Length, DateTimeOffset.UtcNow);
}

public sealed class EnrollmentClient(
    HttpClient httpClient,
    IIdentityStore identityStore,
    IOptions<AgentOptions> optionsAccessor)
{
    private AgentOptions Options => optionsAccessor.Value;

    public async Task<AgentIdentity> EnrollAsync(CancellationToken cancellationToken)
    {
        var existing = await identityStore.LoadAsync(cancellationToken).ConfigureAwait(false);
        if (existing is not null) return existing;
        if (string.IsNullOrWhiteSpace(Options.EnrollmentToken))
            throw new InvalidOperationException("EnrollmentToken is required for first enrollment.");

        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var agentId = Guid.NewGuid().ToString("N");
        var request = new
        {
            token = Options.EnrollmentToken,
            agent_id = agentId,
            public_key = new string(PemEncoding.Write("PUBLIC KEY", key.ExportSubjectPublicKeyInfo())),
            agent_version = typeof(EnrollmentClient).Assembly.GetName().Version?.ToString() ?? "1.0",
            os = Environment.OSVersion.VersionString,
            architecture = RuntimeInformation.ProcessArchitecture.ToString()
        };
        var gatewayHttp = new UriBuilder(Options.AgentGatewayUrl)
        {
            Scheme = Options.AgentGatewayUrl.Scheme.StartsWith("wss", StringComparison.OrdinalIgnoreCase) ? "https" : "http",
            Path = "/v1/enroll",
            Query = string.Empty
        }.Uri;
        using var response = await httpClient.PostAsJsonAsync(gatewayHttp, request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false));
        var enrolledId = document.RootElement.TryGetProperty("agent_id", out var idEl)
            ? idEl.GetString() ?? agentId
            : agentId;
        var identity = new AgentIdentity(enrolledId, key.ExportPkcs8PrivateKey(), key.ExportSubjectPublicKeyInfo());
        await identityStore.SaveAsync(identity, cancellationToken).ConfigureAwait(false);
        return identity;
    }
}

public sealed class GatewayConnection(
    IOptions<AgentOptions> optionsAccessor,
    CommandValidator validator,
    IResultSpool spool,
    NamedPipeIpcClient pipeClient,
    ILogger<GatewayConnection> logger)
{
    private AgentOptions Options => optionsAccessor.Value;

    public async Task ConnectUntilClosedAsync(AgentIdentity identity, CancellationToken cancellationToken)
    {
        using var socket = new ClientWebSocket();
        await socket.ConnectAsync(
            new Uri(Options.AgentGatewayUrl, $"/v1/agents/connect?agent_id={Uri.EscapeDataString(identity.AgentId)}"),
            cancellationToken).ConfigureAwait(false);
        var challenge = await ReceiveJsonAsync(socket, cancellationToken).ConfigureAwait(false);
        var nonce = challenge.GetProperty("nonce").GetString()
            ?? throw new InvalidDataException("Gateway did not send a nonce.");
        using var key = ECDsa.Create();
        key.ImportPkcs8PrivateKey(identity.PrivateKey, out _);
        await SendAsync(socket, new
        {
            signature = Convert.ToBase64String(key.SignData(Encoding.UTF8.GetBytes(nonce), HashAlgorithmName.SHA256))
        }, cancellationToken).ConfigureAwait(false);
        await ReceiveJsonAsync(socket, cancellationToken).ConfigureAwait(false);
        await SendAsync(socket, new
        {
            type = "capabilities",
            capabilities = CommandTypes.Allowed.Order().Select(command_type => new { capability = command_type, command_type })
        }, cancellationToken).ConfigureAwait(false);
        await FlushSpoolAsync(socket, cancellationToken).ConfigureAwait(false);

        using var heartbeatCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var heartbeat = HeartbeatLoopAsync(socket, heartbeatCts.Token);

        try
        {
            while (socket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                var message = await ReceiveJsonAsync(socket, cancellationToken).ConfigureAwait(false);
                if (!message.TryGetProperty("type", out var type) || type.GetString() != "command") continue;

                var command = ParseCommand(message.GetProperty("command"));
                var result = await ExecuteAsync(command, cancellationToken).ConfigureAwait(false);
                try
                {
                    await SendCommandResultAsync(socket, command, result, cancellationToken).ConfigureAwait(false);
                }
                catch
                {
                    await spool.EnqueueAsync(result, CancellationToken.None).ConfigureAwait(false);
                    throw;
                }
            }
        }
        finally
        {
            heartbeatCts.Cancel();
            try { await heartbeat.ConfigureAwait(false); }
            catch (OperationCanceledException) { }
        }
    }

    private async Task HeartbeatLoopAsync(ClientWebSocket socket, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested && socket.State == WebSocketState.Open)
        {
            await SendAsync(socket, new
            {
                type = "heartbeat",
                status = "ONLINE",
                runtime_os = OperatingSystem.IsWindows() ? "Windows" : Environment.OSVersion.Platform.ToString(),
                real_execution = true,
                simulated = false,
                desktop_execution = true
            }, cancellationToken).ConfigureAwait(false);
            await Task.Delay(TimeSpan.FromSeconds(Math.Max(5, Options.HeartbeatSeconds)), cancellationToken).ConfigureAwait(false);
        }
    }

    internal static CommandEnvelope ParseCommand(JsonElement command)
    {
        if (command.TryGetProperty("commandType", out _) || command.TryGetProperty("CommandType", out _))
            return command.Deserialize<CommandEnvelope>()
                ?? throw new InvalidDataException("Invalid command envelope.");

        var payload = command.TryGetProperty("payload", out var payloadEl)
            ? payloadEl.Clone()
            : JsonDocument.Parse("{}").RootElement.Clone();
        var expires = command.TryGetProperty("expires_at", out var exp)
            ? DateTimeOffset.Parse(exp.GetString()!)
            : DateTimeOffset.UtcNow.AddMinutes(5);
        var issued = command.TryGetProperty("issued_at", out var issuedAt) && issuedAt.ValueKind == JsonValueKind.String
            ? DateTimeOffset.Parse(issuedAt.GetString()!)
            : DateTimeOffset.UtcNow;
        return new CommandEnvelope(
            "1.0",
            command.GetProperty("execution_command_id").GetString()!,
            command.GetProperty("command_type").GetString()!,
            command.TryGetProperty("organization_id", out var org) ? org.ToString() : "",
            command.TryGetProperty("project_id", out var project) ? project.ToString() : "",
            command.TryGetProperty("agent_id", out var agent) ? agent.GetString() ?? "" : "",
            command.TryGetProperty("interactive_session_id", out var session) ? session.GetString() : null,
            command.GetProperty("correlation_id").GetString()!,
            command.GetProperty("idempotency_key").GetString()!,
            issued,
            expires,
            JsonDocument.Parse("{}").RootElement.Clone(),
            payload,
            command.TryGetProperty("payload_hash", out var hash) ? hash.GetString() ?? "" : "");
    }

    public async Task<CommandResult> ExecuteAsync(CommandEnvelope command, CancellationToken cancellationToken)
    {
        var validation = validator.Validate(command, DateTimeOffset.UtcNow);
        if (validation != ErrorCode.None)
            return new CommandResult(command.MessageId, false, validation, validation.ToString());

        try
        {
            var timeout = CommandTypes.IpcTimeout(command.CommandType);
            var requestTimeout = (int)Math.Clamp(timeout.TotalMilliseconds - 5_000, 5_000, int.MaxValue);
            var response = await pipeClient.SendAsync(
                Options.SessionHostPipeName,
                new IpcRequest(command.MessageId, command.CommandType, command.Payload, requestTimeout),
                timeout,
                cancellationToken).ConfigureAwait(false);
            return new CommandResult(command.MessageId, response.Success, response.ErrorCode, response.Message, response.Payload);
        }
        catch (Exception exception) when (exception is IOException or OperationCanceledException or TimeoutException)
        {
            logger.LogWarning(exception, "SessionHost IPC failed for {MessageId}", command.MessageId);
            return new CommandResult(command.MessageId, false, ErrorCode.WINDOWS_RUNTIME_UNAVAILABLE, "SessionHost IPC unavailable.");
        }
    }

    public async Task FlushSpoolAsync(ClientWebSocket socket, CancellationToken cancellationToken)
    {
        foreach (var result in await spool.DrainAsync(cancellationToken).ConfigureAwait(false))
            await SendAsync(socket, new { type = "command_result", command_result = result }, cancellationToken).ConfigureAwait(false);
    }

    private static Task SendCommandResultAsync(
        ClientWebSocket socket,
        CommandEnvelope command,
        CommandResult result,
        CancellationToken cancellationToken) =>
        SendAsync(socket, new
        {
            type = "command_result",
            command_result = new
            {
                execution_command_id = command.MessageId,
                status = result.Success ? "COMPLETED" : "FAILED",
                result,
                error_code = result.ErrorCode.ToString()
            }
        }, cancellationToken);

    private static async Task SendAsync(ClientWebSocket socket, object value, CancellationToken cancellationToken)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value);
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken).ConfigureAwait(false);
    }

    private static async Task<JsonElement> ReceiveJsonAsync(ClientWebSocket socket, CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        var bytes = new byte[8192];
        WebSocketReceiveResult result;
        do
        {
            result = await socket.ReceiveAsync(bytes, cancellationToken).ConfigureAwait(false);
            if (result.MessageType == WebSocketMessageType.Close)
                throw new WebSocketException("Gateway closed the connection.");
            buffer.Write(bytes, 0, result.Count);
            if (buffer.Length > 32L * 1024 * 1024)
                throw new InvalidDataException("Gateway message exceeded the 32 MiB safety limit.");
        } while (!result.EndOfMessage);
        using var document = JsonDocument.Parse(buffer.ToArray());
        return document.RootElement.Clone();
    }
}
