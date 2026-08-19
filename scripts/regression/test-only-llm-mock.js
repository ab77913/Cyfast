// TEST-ONLY deterministic OpenAI-compatible mock for CyFAST pipeline regression.
// Must never be pointed at by production configuration.
"use strict";
const http = require("http");
const port = Number(process.env.PORT || 8199);
const payload = {
  id: "chatcmpl-test",
  object: "chat.completion",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          requirements: [
            {
              title: "W1 Regression Requirement",
              description: "Deterministic requirement",
              priority: "medium",
            },
          ],
          scenarios: [{ title: "W1 Regression Scenario", steps: ["open", "assert"] }],
          test_cases: [{ title: "W1 Regression Case", steps: ["step1"], expected: "ok" }],
        }),
      },
    },
  ],
};

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    console.log("[TEST-ONLY-LLM]", req.method, req.url);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-CyFAST-Test-LLM": "true",
    });
    res.end(JSON.stringify(payload));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[TEST-ONLY-LLM] listening on 127.0.0.1:${port}`);
});
