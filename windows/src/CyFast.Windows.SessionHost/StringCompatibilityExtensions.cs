namespace CyFast.Windows.SessionHost;

internal static class StringCompatibilityExtensions
{
    /// <summary>
    /// Provides the comparison-aware char overload used by package path validation.
    /// The BCL exposes comparison-aware StartsWith for strings, but not for chars.
    /// </summary>
    public static bool StartsWith(this string value, char prefix, StringComparison comparisonType) =>
        value.StartsWith(prefix.ToString(), comparisonType);
}
