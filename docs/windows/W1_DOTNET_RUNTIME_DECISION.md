# W1 .NET runtime decision

The Windows W1 solution targets `net9.0-windows` and is pinned to .NET SDK
`9.0.316` in `windows/global.json`. `rollForward: latestFeature` permits a
newer 9.0 feature-band SDK when the exact patch is unavailable, while
preventing accidental use of a future major SDK.

The UI fixture is a native `WinExe`. UIA integration tests launch its built
`.exe` directly from the test output directory; they do not invoke a copied
DLL through `dotnet`. This preserves Windows process/window semantics and
provides a reliable process ID for process-scoped UIA and screenshots.
