using CyFast.Windows.Contracts;
using CyFast.Windows.SessionHost;

namespace CyFast.Windows.SessionHost.Tests;

public sealed class SessionHostTests
{
    [Fact]
    public void Profile_validator_rejects_traversal_and_unc()
    {
        Assert.Equal(ErrorCode.InvalidProfile, ProfileValidator.Validate(new ApplicationProfile("x", @"C:\safe\..\bad.exe")));
        Assert.Equal(ErrorCode.InvalidProfile, ProfileValidator.Validate(new ApplicationProfile("x", @"\\server\share\app.exe")));
    }
}
