using CyFast.Windows.Uia;
using CyFast.Windows.SessionHost;
using CyFast.Windows.Contracts;
using System.Text.Json;

namespace CyFast.Windows.Uia.Tests;

public sealed class UiaIntegrationTests
{
    [Fact]
    public void Selector_candidates_prioritize_automation_id()
    {
        var candidates = SelectorCandidates.Create("CyFastFixture.TextInput", "Input", "Edit");
        Assert.Equal("automationId", candidates[0].Strategy);
        Assert.Equal(1.0, candidates[0].StabilityScore);
    }

    [Fact]
    [Trait("Category", "UiaIntegration")]
    public async Task Fixture_supports_bounded_process_scoped_uia_workflow()
    {
        if (DesktopState.GetError() != CyFast.Windows.Contracts.ErrorCode.None)
            Assert.Fail("BLOCKED: no interactive session");

        var evidence = await Sta.RunAsync(RunFixtureWorkflow);

        Assert.Equal("CyFastFixture.Main", evidence.Root.AutomationId);
        Assert.Contains("CyFastFixture.TextInput", evidence.ElementIds);
        Assert.Contains("CyFastFixture.PasswordInput", evidence.ElementIds);
        Assert.Equal("***MASKED***", evidence.PasswordValue);
        Assert.Contains("CyFastFixture.ActionButton", evidence.ElementIds);
        Assert.Contains("CyFastFixture.CheckBox", evidence.ElementIds);
        Assert.Contains("CyFastFixture.ComboBox", evidence.ElementIds);
        Assert.Contains("CyFastFixture.ListBox", evidence.ElementIds);
        Assert.Contains("CyFastFixture.StatusLabel", evidence.ElementIds);
        Assert.Contains("CyFastFixture.DisabledButton", evidence.ElementIds);
        Assert.Contains("CyFastFixture.DynamicControl", evidence.ElementIds);
        Assert.Contains("CyFastFixture.ScrollPanel", evidence.ElementIds);
        Assert.False(evidence.DisabledButtonEnabled);
        Assert.Equal("OK:hello", evidence.StatusValue);
        Assert.True(evidence.ScreenshotBytes > 0);
        Assert.Equal("CyFastFixture.Main", evidence.DeserializedRootId);
    }

    private static WorkflowEvidence RunFixtureWorkflow()
    {
        using var fixture = FixtureHarness.Start();
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        using var automation = new FlaUi3Backend();
        var scope = $"pid:{fixture.ProcessId}|";

        WaitUntil(() => automation.FindByAutomationId("CyFastFixture.TextInput", fixture.ProcessId), TimeSpan.FromSeconds(10), cancellation.Token);
        var before = automation.InspectProcessAsync(fixture.ProcessId, new TraversalOptions(MaxDepth: 6, MaxElements: 100, TimeoutMs: 5000), cancellation.Token)
            .GetAwaiter().GetResult();
        var initial = Flatten(before.Root).ToArray();

        automation.SetValueAsync(scope + "CyFastFixture.TextInput", "hello", cancellation.Token).GetAwaiter().GetResult();
        automation.SelectAsync(scope + "CyFastFixture.CheckBox", "true", cancellation.Token).GetAwaiter().GetResult();
        automation.SelectAsync(scope + "CyFastFixture.ComboBox", "Two", cancellation.Token).GetAwaiter().GetResult();
        automation.InvokeAsync(scope + "CyFastFixture.ShowDynamic", cancellation.Token).GetAwaiter().GetResult();
        automation.InvokeAsync(scope + "CyFastFixture.ActionButton", cancellation.Token).GetAwaiter().GetResult();

        WaitUntil(
            () => automation.FindByAutomationId("CyFastFixture.DynamicControl", fixture.ProcessId),
            TimeSpan.FromSeconds(5),
            cancellation.Token);
        var after = automation.InspectProcessAsync(fixture.ProcessId, new TraversalOptions(MaxDepth: 6, MaxElements: 100, TimeoutMs: 5000), cancellation.Token)
            .GetAwaiter().GetResult();
        var elements = Flatten(after.Root).ToArray();
        var serialized = JsonSerializer.Serialize(after);
        var roundTrip = JsonSerializer.Deserialize<UiSnapshot>(serialized)
            ?? throw new InvalidOperationException("UI snapshot JSON did not deserialize.");
        var screenshot = automation.CaptureScreenshotAsync(fixture.ProcessId, cancellation.Token).GetAwaiter().GetResult();
        automation.InvokeAsync(scope + "CyFastFixture.OpenDialog", cancellation.Token).GetAwaiter().GetResult(); // modal is cleaned up with the fixture

        return new WorkflowEvidence(
            after.Root,
            initial.Select(element => element.AutomationId).ToHashSet(StringComparer.Ordinal),
            elements.Select(element => element.AutomationId).ToHashSet(StringComparer.Ordinal),
            initial.Single(element => element.AutomationId == "CyFastFixture.PasswordInput").Value,
            elements.Single(element => element.AutomationId == "CyFastFixture.DisabledButton").IsEnabled,
            elements.Single(element => element.AutomationId == "CyFastFixture.StatusLabel").Name,
            screenshot.Length,
            roundTrip.Root.AutomationId);
    }

    private static IEnumerable<UiElement> Flatten(UiElement element)
    {
        yield return element;
        foreach (var child in element.Children ?? [])
            foreach (var descendant in Flatten(child))
                yield return descendant;
    }

    private static void WaitUntil(Func<object> action, TimeSpan timeout, CancellationToken cancellationToken)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try { _ = action(); return; }
            catch (InvalidOperationException) { Thread.Sleep(100); }
        }
        throw new TimeoutException($"UIA_TIMEOUT: operation did not complete within {timeout.TotalSeconds:n0} seconds.");
    }

    private sealed record WorkflowEvidence(
        UiElement Root,
        HashSet<string> InitialElementIds,
        HashSet<string> ElementIds,
        string? PasswordValue,
        bool DisabledButtonEnabled,
        string StatusValue,
        int ScreenshotBytes,
        string DeserializedRootId);
}

internal static class Sta
{
    public static Task<T> RunAsync<T>(Func<T> operation)
    {
        var completion = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() =>
        {
            try { completion.SetResult(operation()); }
            catch (Exception exception) { completion.SetException(exception); }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        return completion.Task;
    }
}
