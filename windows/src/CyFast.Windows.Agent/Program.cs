using CyFast.Windows.Agent;
using CyFast.Windows.Ipc;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Agent"));
builder.Services.AddSingleton<IIdentityStore, DpapiIdentityStore>();
builder.Services.AddSingleton<CommandValidator>();
builder.Services.AddSingleton<IResultSpool, InMemoryResultSpool>();
builder.Services.AddSingleton<NamedPipeIpcClient>();
builder.Services.AddHttpClient<EnrollmentClient>();
builder.Services.AddSingleton<GatewayConnection>();
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
