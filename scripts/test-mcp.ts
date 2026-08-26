import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const mcpUrl = process.argv[2] ?? "http://127.0.0.1:8787/mcp";
const bridgeCode = process.argv[3];

if (!bridgeCode) {
  console.error("Usage: npm run test:mcp -- <mcp-url> <bridge-code>");
  process.exit(1);
}

const client = new Client(
  { name: "sensorium-smoke-test", version: "1.0.0" },
  { versionNegotiation: { mode: "auto" } },
);

await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));

const tools = await client.listTools();
const comparison = await client.callTool({ name: "compare_places", arguments: { bridgeCode } });
const intervention = await client.callTool({
  name: "propose_intervention",
  arguments: {
    bridgeCode,
    text: "Move the task lamp closer and close the window for one focus block.",
    rationale: "The window sample is quieter and substantially brighter than the current desk baseline.",
  },
});

console.log(JSON.stringify({
  protocolEra: client.getProtocolEra(),
  server: client.getServerVersion(),
  tools: tools.tools.map((tool) => tool.name),
  comparison: comparison.structuredContent,
  intervention: intervention.structuredContent,
}, null, 2));

await client.close();
