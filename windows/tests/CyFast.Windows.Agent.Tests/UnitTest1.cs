using System.Text.Json;
using CyFast.Windows.Agent;
using CyFast.Windows.Contracts;

namespace CyFast.Windows.Agent.Tests;

public sealed class AgentTests
{
    [Theory]
    [InlineData("windows.health", ErrorCode.None)]
    [InlineData("windows.shell", ErrorCode.UnsupportedCommand)]
    [InlineData("run_arbitrary_command", ErrorCode.UnsupportedCommand)]
    public void Validator_enforces_allowlist(string commandType, ErrorCode expected)
    {
        var validator = new CommandValidator();
        Assert.Equal(expected, validator.Validate(Command(commandType), DateTimeOffset.UtcNow));
    }

    [Fact] public void Validator_rejects_expired_and_duplicate_commands()
    {
        var validator = new CommandValidator();
        Assert.Equal(ErrorCode.ExpiredCommand, validator.Validate(Command("windows.health", DateTimeOffset.UtcNow.AddSeconds(-1)), DateTimeOffset.UtcNow));
        var command = Command("windows.health");
        Assert.Equal(ErrorCode.None, validator.Validate(command, DateTimeOffset.UtcNow));
        Assert.Equal(ErrorCode.DuplicateCommand, validator.Validate(command, DateTimeOffset.UtcNow));
    }

    [Fact] public async Task In_memory_identity_and_spool_round_trip()
    {
        var store = new InMemoryIdentityStore();
        var identity = new AgentIdentity("a", [1], [2]);
        await store.SaveAsync(identity, default);
        Assert.Equal(identity, await store.LoadAsync(default));
        var spool = new InMemoryResultSpool();
        await spool.EnqueueAsync(new CommandResult("r", true), default);
        Assert.Single(await spool.DrainAsync(default));
    }

    [Fact] public void Evidence_hash_is_sha256() =>
        Assert.Equal("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", EvidenceHasher.Hash("abc"u8, "text/plain").Sha256);

    private static CommandEnvelope Command(string type, DateTimeOffset? expiry = null) =>
        new("1.0", "r", type, expiry ?? DateTimeOffset.UtcNow.AddMinutes(1), Guid.NewGuid().ToString(), JsonDocument.Parse("{}").RootElement.Clone());
}
