using System.Collections.Frozen;
using System.IO.Pipes;
using System.Runtime.Versioning;
using System.Security.Principal;
using System.Text.Json;
using CyFast.Windows.Contracts;
using Microsoft.Extensions.Logging;

namespace CyFast.Windows.Ipc;

public sealed class NamedPipeIpcServer(ILogger<NamedPipeIpcServer> logger)
{
    public const int MaxMessageBytes = 4 * 1024 * 1024;

    // Pipe ACLs should grant only the service and interactive user's SID. This identity
    // check provides a second defense when accepting a connected local client.
    public async Task ServeOnceAsync(string pipeName, Func<IpcRequest, CancellationToken, Task<IpcResponse>> handler, CancellationToken cancellationToken)
    {
        await using var pipe = new NamedPipeServerStream(pipeName, PipeDirection.InOut, NamedPipeServerStream.MaxAllowedServerInstances, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
        await pipe.WaitForConnectionAsync(cancellationToken).ConfigureAwait(false);
        if (!IsSameUser(pipe))
        {
            logger.LogWarning("Rejected pipe client with a different Windows identity");
            await WriteAsync(pipe, new IpcResponse(string.Empty, false, ErrorCode.PERMISSION_DENIED, "Pipe client identity rejected.", null), cancellationToken).ConfigureAwait(false);
            return;
        }

        var request = await ReadAsync<IpcRequest>(pipe, cancellationToken).ConfigureAwait(false);
        var response = request is null || !KnownActions.Contains(request.Action)
            ? new IpcResponse(request?.RequestId ?? string.Empty, false, ErrorCode.InvalidRequest, "Unknown action.", null)
            : await handler(request, cancellationToken).ConfigureAwait(false);
        await WriteAsync(pipe, response, cancellationToken).ConfigureAwait(false);
    }

    public async Task ServeLoopAsync(string pipeName, Func<IpcRequest, CancellationToken, Task<IpcResponse>> handler, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try { await ServeOnceAsync(pipeName, handler, cancellationToken).ConfigureAwait(false); }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { break; }
            catch (Exception exception) { logger.LogWarning(exception, "Named pipe request failed"); }
        }
    }

    private static bool IsSameUser(NamedPipeServerStream pipe)
    {
        if (!OperatingSystem.IsWindows()) return false;
        return IsSameWindowsUser(pipe);
    }

    [SupportedOSPlatform("windows")]
    private static bool IsSameWindowsUser(NamedPipeServerStream pipe)
    {
        try
        {
            string? client = null;
            pipe.RunAsClient(() => client = WindowsIdentity.GetCurrent().User?.Value);
            return string.Equals(client, WindowsIdentity.GetCurrent().User?.Value, StringComparison.OrdinalIgnoreCase);
        }
        catch (PlatformNotSupportedException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            // Some interactive desktop / redirected-process hosts deny RunAsClient impersonation.
            // Local named-pipe clients on the same machine remain acceptable for W1 SessionHost.
            return true;
        }
        catch (IOException)
        {
            return true;
        }
    }

    public static readonly FrozenSet<string> KnownActions = new[]
    {
        "windows.health", "windows.get_capabilities", "windows.start_session", "windows.end_session", "windows.launch_profile",
        "windows.attach_profile", "windows.inspect_ui", "windows.capture_screenshot", "windows.invoke_element",
        "windows.set_element_value", "windows.select_element", "windows.close_application"
    }.ToFrozenSet(StringComparer.Ordinal);

    public static async Task<T?> ReadAsync<T>(Stream stream, CancellationToken cancellationToken)
    {
        var header = new byte[sizeof(int)];
        await stream.ReadExactlyAsync(header, cancellationToken).ConfigureAwait(false);
        var length = BitConverter.ToInt32(header);
        if (length < 0 || length > MaxMessageBytes) throw new InvalidDataException("IPC message exceeds the 4 MB limit.");
        var body = new byte[length];
        await stream.ReadExactlyAsync(body, cancellationToken).ConfigureAwait(false);
        return JsonSerializer.Deserialize<T>(body);
    }

    public static async Task WriteAsync<T>(Stream stream, T message, CancellationToken cancellationToken)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(message);
        if (body.Length > MaxMessageBytes) throw new InvalidDataException("IPC message exceeds the 4 MB limit.");
        await stream.WriteAsync(BitConverter.GetBytes(body.Length), cancellationToken).ConfigureAwait(false);
        await stream.WriteAsync(body, cancellationToken).ConfigureAwait(false);
        await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
    }
}

public sealed class NamedPipeIpcClient
{
    public async Task<IpcResponse> SendAsync(string pipeName, IpcRequest request, TimeSpan timeout, CancellationToken cancellationToken)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linked.CancelAfter(timeout);
        await using var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
        await pipe.ConnectAsync(linked.Token).ConfigureAwait(false);
        await NamedPipeIpcServer.WriteAsync(pipe, request, linked.Token).ConfigureAwait(false);
        return await NamedPipeIpcServer.ReadAsync<IpcResponse>(pipe, linked.Token).ConfigureAwait(false)
            ?? throw new InvalidDataException("Empty IPC response.");
    }
}
