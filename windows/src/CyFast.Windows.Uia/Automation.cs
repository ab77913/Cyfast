using System.Runtime.CompilerServices;
using System.Drawing;
using System.Drawing.Imaging;
using CyFast.Windows.Contracts;
using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;

namespace CyFast.Windows.Uia;

public interface IUiAutomationBackend
{
    Task<UiSnapshot> InspectAsync(TraversalOptions options, CancellationToken cancellationToken);
    Task<UiSnapshot> InspectProcessAsync(int processId, TraversalOptions options, CancellationToken cancellationToken);
    Task InvokeAsync(string selector, CancellationToken cancellationToken);
    Task SetValueAsync(string selector, string value, CancellationToken cancellationToken);
    Task SelectAsync(string selector, string value, CancellationToken cancellationToken);
    Task<byte[]> CaptureScreenshotAsync(CancellationToken cancellationToken);
    Task<byte[]> CaptureScreenshotAsync(int processId, CancellationToken cancellationToken);
}

public sealed record TraversalOptions(int MaxDepth = 8, int MaxElements = 500, int TimeoutMs = 5000);

public sealed class FlaUi3Backend : IUiAutomationBackend, IDisposable
{
    private readonly UIA3Automation _automation = new();

    public Task<UiSnapshot> InspectAsync(TraversalOptions options, CancellationToken cancellationToken)
    {
        return Inspect(_automation.GetDesktop(), options, cancellationToken);
    }

    /// <summary>Inspects only a process main window, avoiding an unbounded desktop traversal.</summary>
    public Task<UiSnapshot> InspectProcessAsync(int processId, TraversalOptions options, CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(processId);
        return Inspect(ResolveProcessWindow(processId), options, cancellationToken);
    }

    private static Task<UiSnapshot> Inspect(AutomationElement root, TraversalOptions options, CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(options.MaxDepth);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(options.MaxElements);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(options.TimeoutMs);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromMilliseconds(options.TimeoutMs));
        var count = 0;
        var seen = new HashSet<int>();
        var snapshot = ToElement(root, 0, options, ref count, seen, timeout.Token);
        return Task.FromResult(new UiSnapshot(snapshot, DateTimeOffset.UtcNow, count >= options.MaxElements));
    }

    public Task InvokeAsync(string selector, CancellationToken cancellationToken)
    {
        var element = WaitForElement(selector, cancellationToken);
        Focus(element);
        var invoke = element.Patterns.Invoke.PatternOrDefault;
        if (invoke is null) throw new InvalidOperationException("ELEMENT_NOT_INTERACTABLE: InvokePattern is unavailable.");
        invoke.Invoke();
        return Task.CompletedTask;
    }

    public Task SetValueAsync(string selector, string value, CancellationToken cancellationToken)
    {
        var element = WaitForElement(selector, cancellationToken);
        Focus(element);
        var pattern = element.Patterns.Value.PatternOrDefault;
        if (pattern is null || pattern.IsReadOnly.ValueOrDefault)
            throw new InvalidOperationException("ELEMENT_NOT_INTERACTABLE: ValuePattern is unavailable or read-only.");
        pattern.SetValue(value);
        return Task.CompletedTask;
    }

    public Task SelectAsync(string selector, string value, CancellationToken cancellationToken)
    {
        var element = WaitForElement(selector, cancellationToken);
        Focus(element);
        var toggle = element.Patterns.Toggle.PatternOrDefault;
        if (toggle is not null)
        {
            var desiredOn = value.Equals("true", StringComparison.OrdinalIgnoreCase) || value.Equals("checked", StringComparison.OrdinalIgnoreCase);
            var currentOn = toggle.ToggleState == FlaUI.Core.Definitions.ToggleState.On;
            if (desiredOn != currentOn) toggle.Toggle();
            return Task.CompletedTask;
        }

        var valuePattern = element.Patterns.Value.PatternOrDefault;
        if (valuePattern is not null && !valuePattern.IsReadOnly)
        {
            try
            {
                valuePattern.SetValue(value);
                return Task.CompletedTask;
            }
            catch
            {
                /* fall through to selection item */
            }
        }

        var expandCollapse = element.Patterns.ExpandCollapse.PatternOrDefault;
        expandCollapse?.Expand();
        try
        {
            var deadline = DateTime.UtcNow.AddSeconds(3);
            FlaUI.Core.AutomationElements.AutomationElement? item = null;
            while (DateTime.UtcNow < deadline && item is null)
            {
                cancellationToken.ThrowIfCancellationRequested();
                item = element.FindFirstDescendant(cf => cf.ByName(value))
                    ?? element.FindFirstDescendant(cf => cf.ByText(value));
                if (item is null) Thread.Sleep(50);
            }
            var selectionItem = item?.Patterns.SelectionItem.PatternOrDefault;
            if (selectionItem is not null)
            {
                selectionItem.Select();
                return Task.CompletedTask;
            }

            if (item is not null)
            {
                item.Click();
                return Task.CompletedTask;
            }

            throw new InvalidOperationException("ELEMENT_NOT_INTERACTABLE: selection item was not found.");
        }
        finally
        {
            try { expandCollapse?.Collapse(); } catch { /* ignore collapse failures after select */ }
        }
    }

    public Task<byte[]> CaptureScreenshotAsync(CancellationToken cancellationToken)
        => CaptureScreenshotAsync(null, cancellationToken);

    public Task<byte[]> CaptureScreenshotAsync(int processId, CancellationToken cancellationToken)
        => CaptureScreenshotAsync((int?)processId, cancellationToken);

    private Task<byte[]> CaptureScreenshotAsync(int? processId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var bounds = processId is null ? Rectangle.Empty : GetWindowBounds(processId.Value);
            if (bounds.Width <= 0 || bounds.Height <= 0)
                bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds ?? Rectangle.Empty;
            if (bounds.Width <= 0 || bounds.Height <= 0) throw new InvalidOperationException("No desktop bounds are available.");
            using var bitmap = new Bitmap(bounds.Width, bounds.Height);
            using (var graphics = Graphics.FromImage(bitmap))
                graphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
            using var output = new MemoryStream();
            bitmap.Save(output, ImageFormat.Png);
            return Task.FromResult(output.ToArray());
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new InvalidOperationException("SCREENSHOT_FAILED", exception);
        }
    }

    public AutomationElement FindByAutomationId(string automationId, int? processId = null, string? windowTitle = null)
    {
        var scope = ResolveScope(processId, windowTitle);
        return scope.FindFirstDescendant(cf => cf.ByAutomationId(automationId))
            ?? throw new InvalidOperationException("ELEMENT_NOT_FOUND");
    }

    private AutomationElement WaitForElement(string selector, CancellationToken cancellationToken)
    {
        var (automationId, processId, windowTitle) = ParseSelector(selector);
        var until = DateTime.UtcNow.AddSeconds(5);
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try { return FindByAutomationId(automationId, processId, windowTitle); }
            catch (InvalidOperationException) when (DateTime.UtcNow < until) { Thread.Sleep(75); }
            catch (InvalidOperationException) { throw new TimeoutException("UIA_TIMEOUT: element did not appear."); }
        }
    }

    private AutomationElement ResolveScope(int? processId, string? windowTitle)
    {
        var desktop = _automation.GetDesktop();
        if (processId is not null)
            return ResolveProcessWindow(processId.Value);
        if (!string.IsNullOrWhiteSpace(windowTitle))
            return desktop.FindFirstDescendant(cf => cf.ByName(windowTitle))
                ?? throw new InvalidOperationException("WINDOW_NOT_FOUND");
        return desktop;
    }

    private AutomationElement ResolveProcessWindow(int processId)
    {
        // Top-level application windows are direct desktop children. Do not use a
        // descendant search here: it can enumerate the entire desktop.
        return _automation.GetDesktop().FindFirstChild(cf => cf.ByProcessId(processId))
            ?? throw new InvalidOperationException("PROCESS_NOT_FOUND");
    }

    private Rectangle GetWindowBounds(int processId)
    {
        var rectangle = ResolveProcessWindow(processId).BoundingRectangle;
        return Rectangle.FromLTRB((int)rectangle.Left, (int)rectangle.Top, (int)rectangle.Right, (int)rectangle.Bottom);
    }

    private static (string AutomationId, int? ProcessId, string? WindowTitle) ParseSelector(string selector)
    {
        // "automationId" searches desktop; optional scope is "pid:123|automationId" or "window:Title|automationId".
        var parts = selector.Split('|', 2);
        if (parts.Length == 1) return (selector, null, null);
        if (parts[0].StartsWith("pid:", StringComparison.OrdinalIgnoreCase) && int.TryParse(parts[0][4..], out var processId))
            return (parts[1], processId, null);
        if (parts[0].StartsWith("window:", StringComparison.OrdinalIgnoreCase))
            return (parts[1], null, parts[0][7..]);
        return (selector, null, null);
    }

    private static void Focus(AutomationElement element)
    {
        if (!element.IsEnabled) throw new InvalidOperationException("ELEMENT_NOT_INTERACTABLE: element is disabled.");
        element.Focus();
    }

    private static UiElement ToElement(FlaUI.Core.AutomationElements.AutomationElement element, int depth, TraversalOptions options, ref int count, HashSet<int> seen, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        count++;
        var id = element.Properties.AutomationId.ValueOrDefault ?? string.Empty;
        var value = element.Properties.IsPassword.ValueOrDefault ? "***MASKED***" : element.Patterns.Value.PatternOrDefault?.Value.ValueOrDefault;
        var children = new List<UiElement>();
        if (depth < options.MaxDepth && count < options.MaxElements && seen.Add(RuntimeHelpers.GetHashCode(element)))
        {
            // The bounded recursion, element cap, and linked timeout are deliberate:
            // providers can expose unexpectedly large trees.
            foreach (var child in element.FindAllChildren())
            {
                if (count >= options.MaxElements) break;
                children.Add(ToElement(child, depth + 1, options, ref count, seen, token));
            }
        }
        return new UiElement(id, element.Name, element.ControlType.ToString(), value, element.IsEnabled, element.IsOffscreen,
            SelectorCandidates.Create(id, element.Name, element.ControlType.ToString()), children);
    }

    public void Dispose() => _automation.Dispose();
}

public static class SelectorCandidates
{
    public static IReadOnlyList<SelectorCandidate> Create(string automationId, string name, string controlType) =>
        string.IsNullOrWhiteSpace(automationId)
            ? new[] { new SelectorCandidate("name+type", $"{name}|{controlType}", 0.50) }
            : new[] { new SelectorCandidate("automationId", automationId, 1.0), new SelectorCandidate("name+type", $"{name}|{controlType}", 0.50) };
}

public interface IAppiumWindowsAdapter { }
public sealed class AppiumWindowsAdapter : IAppiumWindowsAdapter
{
    public void Connect() => throw new NotSupportedException("Appium Windows adapter is not implemented; no automation action was performed.");
}
public interface IWinAppDriverAdapter { }
public sealed class WinAppDriverAdapter : IWinAppDriverAdapter
{
    public void Connect() => throw new NotSupportedException("WinAppDriver adapter is not implemented; no automation action was performed.");
}
