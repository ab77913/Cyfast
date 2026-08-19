using System.Diagnostics;

namespace CyFast.Windows.Uia.Tests;

/// <summary>Starts the WinForms fixture as a native executable and reliably tears it down.</summary>
public sealed class FixtureHarness : IDisposable
{
    private const string FixtureName = "CyFast.Windows.TestFixture";
    private bool _disposed;

    private FixtureHarness(Process process) => Process = process;

    public Process Process { get; }
    public int ProcessId => Process.Id;

    public static FixtureHarness Start(TimeSpan? startupTimeout = null)
    {
        KillStaleFixtures();
        var executable = ResolveExecutable();
        var process = Process.Start(new ProcessStartInfo(executable)
        {
            UseShellExecute = false,
            WorkingDirectory = Path.GetDirectoryName(executable)!
        }) ?? throw new InvalidOperationException($"Could not launch fixture '{executable}'.");

        var harness = new FixtureHarness(process);
        try
        {
            harness.WaitForMainWindow(startupTimeout ?? TimeSpan.FromSeconds(15));
            return harness;
        }
        catch
        {
            harness.Dispose();
            throw;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            if (!Process.HasExited)
            {
                Process.Kill(entireProcessTree: true);
                Process.WaitForExit(5000);
            }
        }
        finally
        {
            Process.Dispose();
        }
    }

    private void WaitForMainWindow(TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (Process.HasExited)
                throw new InvalidOperationException($"Fixture exited early with code {Process.ExitCode}.");

            try { Process.WaitForInputIdle(250); }
            catch (InvalidOperationException) { /* A GUI process may not expose input-idle immediately. */ }

            Process.Refresh();
            if (Process.MainWindowHandle != IntPtr.Zero) return;
            Thread.Sleep(100);
        }

        throw new TimeoutException($"Fixture did not create a main window within {timeout.TotalSeconds:n0} seconds.");
    }

    private static string ResolveExecutable()
    {
        var outputDirectory = AppContext.BaseDirectory;
        var direct = Path.Combine(outputDirectory, FixtureName + ".exe");
        if (File.Exists(direct)) return direct;

        var fixtureOutput = Directory.EnumerateFiles(outputDirectory, FixtureName + ".exe", SearchOption.AllDirectories)
            .FirstOrDefault();
        if (fixtureOutput is not null) return fixtureOutput;

        throw new FileNotFoundException(
            $"The built fixture executable was not found below '{outputDirectory}'. Build the solution before running UIA tests.",
            FixtureName + ".exe");
    }

    private static void KillStaleFixtures()
    {
        foreach (var stale in Process.GetProcessesByName(FixtureName))
        {
            try
            {
                stale.Kill(entireProcessTree: true);
                stale.WaitForExit(5000);
            }
            catch (InvalidOperationException) { }
            finally { stale.Dispose(); }
        }
    }
}
