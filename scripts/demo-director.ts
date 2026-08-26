import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const mcpUrl = process.argv[2] ?? "https://sensorium-devsnorte.fly.dev/mcp";
const expeditionCode = process.argv[3];
const browserBridgeCode = process.argv[4];

if (!expeditionCode || !browserBridgeCode) {
  console.error("Usage: npm run demo:seed -- <mcp-url> <expedition-code> <browser-bridge-code>");
  process.exit(1);
}

const apiOrigin = new URL(mcpUrl).origin;
const now = new Date().toISOString();
const snapshot = {
  investigation: {
    id: "demo-library-station",
    title: "Field Desk Atlas",
    question: "Which field station is best for focused work?",
    status: "active" as const,
    createdAt: now,
  },
  requestedObservation: "Run the shared focus baseline.",
  intervention: "",
  samples: [{
    id: "demo-library-baseline",
    label: "Library window baseline",
    capturedAt: now,
    soundDb: 37,
    brightness: 76,
    steadiness: 94,
    phase: "baseline" as const,
    source: "simulated" as const,
    quality: {
      confidence: 96,
      grade: "high" as const,
      durationMs: 8_000,
      readingCount: 32,
      soundSpread: 2,
      lightSpread: 2,
      motionAvailable: true,
      issues: ["Synthetic demonstration data; not a physical observation."],
      recaptureRecommended: false,
    },
  }],
  activity: [],
};

const stationResponse = await fetch(`${apiOrigin}/api/bridges`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ snapshot, expeditionCode, stationLabel: "Library window — São Paulo" }),
});
if (!stationResponse.ok) throw new Error(`Demo station failed: ${await stationResponse.text()}`);
const station = await stationResponse.json() as { code: string };

const client = new Client(
  { name: "sensorium-demo-director", version: "1.0.0" },
  { versionNegotiation: { mode: "auto" } },
);
await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));

const mission = await client.callTool({
  name: "request_station_observation",
  arguments: {
    expeditionCode,
    prompt: "Rest the phone at the primary work surface and run one complete eight-second focus baseline.",
  },
});
const quality = await client.callTool({
  name: "validate_sample_quality",
  arguments: { bridgeCode: browserBridgeCode },
});
const qualityValue = quality.structuredContent as { quality?: { recaptureRecommended?: boolean; issues?: string[] } };
const recapture = qualityValue.quality?.recaptureRecommended
  ? await client.callTool({
    name: "request_bridge_recapture",
    arguments: {
      bridgeCode: browserBridgeCode,
      reason: qualityValue.quality.issues?.[0] ?? "The current evidence is below the expedition confidence threshold.",
    },
  })
  : undefined;
const comparison = await client.callTool({ name: "compare_stations", arguments: { expeditionCode } });

console.log(JSON.stringify({
  expeditionCode,
  addedStation: { code: station.code, label: "Library window — São Paulo" },
  mission: mission.structuredContent,
  browserQuality: quality.structuredContent,
  recapture: recapture?.structuredContent,
  comparison: comparison.structuredContent,
}, null, 2));

await client.close();
