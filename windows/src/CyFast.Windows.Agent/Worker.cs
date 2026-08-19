using CyFast.Windows.Ipc;
using Microsoft.Extensions.Options;

namespace CyFast.Windows.Agent;

public sealed class Worker(ILogger<Worker> logger, IOptions<AgentOptions> options, EnrollmentClient enrollment, GatewayConnection gateway) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        ValidateTransport(options.Value);
        logger.LogInformation("CyFAST agent started for organization {Organization}", options.Value.Organization);
        var identity = await enrollment.EnrollAsync(stoppingToken).ConfigureAwait(false);
        var retry = TimeSpan.FromSeconds(1);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Desktop automation is deliberately delegated only through SessionHost IPC.
                await gateway.ConnectUntilClosedAsync(identity, stoppingToken).ConfigureAwait(false);
                retry = TimeSpan.FromSeconds(1);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Gateway connection failed; retrying in {Delay}", retry);
                await Task.Delay(retry, stoppingToken).ConfigureAwait(false);
                retry = TimeSpan.FromSeconds(Math.Min(retry.TotalSeconds * 2, 60));
            }
        }
    }

    private static void ValidateTransport(AgentOptions options)
    {
        var uri = options.AgentGatewayUrl;
        if (uri.Scheme == Uri.UriSchemeWss) return;
        if (uri.Scheme == Uri.UriSchemeWs && options.AllowInsecureLocalTransport && (uri.IsLoopback || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))) return;
        throw new InvalidOperationException("AgentGatewayUrl must use wss, or ws only for localhost when AllowInsecureLocalTransport is enabled.");
    }
}
