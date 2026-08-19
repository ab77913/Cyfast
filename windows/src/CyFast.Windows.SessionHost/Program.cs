using CyFast.Windows.SessionHost;
using CyFast.Windows.Ipc;
using Microsoft.Extensions.Logging;

var pipeName = args.FirstOrDefault(arg => arg.StartsWith("--pipe=", StringComparison.OrdinalIgnoreCase))?[7..]
    ?? Environment.GetEnvironmentVariable("CYFAST_SESSION_HOST_PIPE")
    ?? "CyFast.Windows.SessionHost";
using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
using var automation = new CyFast.Windows.Uia.FlaUi3Backend();
using var host = new SessionHost(automation);
var server = new NamedPipeIpcServer(loggerFactory.CreateLogger<NamedPipeIpcServer>());
using var shutdown = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    shutdown.Cancel();
};
await server.ServeLoopAsync(pipeName, host.HandleAsync, shutdown.Token);
