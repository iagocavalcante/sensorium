import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import assert from "node:assert/strict";

const mcpUrl = process.argv[2] ?? "http://127.0.0.1:8787/mcp";
const apiOrigin = new URL(mcpUrl).origin;
const client = new Client(
  { name: "sensorium-expedition-smoke-test", version: "1.0.0" },
  { versionNegotiation: { mode: "auto" } },
);

const makeSnapshot = (station: string, soundDb: number, brightness: number) => ({
  investigation: {
    id: `investigation-${station}`,
    title: "Distributed focus study",
    question: "Which station is best for focused work?",
    status: "active" as const,
    createdAt: new Date().toISOString(),
  },
  requestedObservation: "Capture a baseline reading.",
  intervention: "",
  samples: [{
    id: `sample-${station}-1`,
    label: `${station} baseline`,
    capturedAt: new Date().toISOString(),
    soundDb,
    brightness,
    steadiness: 84,
    phase: "baseline" as const,
    source: "simulated" as const,
  }],
  activity: [],
});

async function openStation(expeditionCode: string, stationLabel: string, snapshot: ReturnType<typeof makeSnapshot>) {
  const response = await fetch(`${apiOrigin}/api/bridges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot, expeditionCode, stationLabel }),
  });
  if (!response.ok) throw new Error(`Station failed: ${await response.text()}`);
  return await response.json() as { code: string; writeToken: string };
}

await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));

const created = await client.callTool({
  name: "create_expedition",
  arguments: {
    title: "Distributed focus study",
    question: "Which station is best for focused work?",
    profile: "focus",
  },
});
const expeditionCode = (created.structuredContent as { expedition: { code: string } }).expedition.code;
const stationA = await openStation(expeditionCode, "Library window", makeSnapshot("library", 39, 78));
const stationB = await openStation(expeditionCode, "Home desk", makeSnapshot("home", 61, 42));

const stations = await client.callTool({ name: "list_field_stations", arguments: { expeditionCode } });
const comparison = await client.callTool({ name: "compare_stations", arguments: { expeditionCode } });
const quality = await client.callTool({
  name: "validate_sample_quality",
  arguments: { bridgeCode: stationB.code },
});
const recapture = await client.callTool({
  name: "request_bridge_recapture",
  arguments: {
    bridgeCode: stationB.code,
    reason: "Use the complete timed protocol so the comparison includes multiple readings.",
  },
});
const initialUpdate = await client.callTool({ name: "await_expedition_update", arguments: { expeditionCode, timeoutSeconds: 2 } });
const cursor = (initialUpdate.structuredContent as { cursor: string }).cursor;

const waiting = client.callTool({
  name: "await_expedition_update",
  arguments: { expeditionCode, afterEventId: cursor, timeoutSeconds: 5 },
});
const updatedSnapshot = makeSnapshot("library", 39, 78);
updatedSnapshot.samples.push({
  ...updatedSnapshot.samples[0],
  id: "sample-library-2",
  label: "Library verification",
  capturedAt: new Date().toISOString(),
  soundDb: 36,
  brightness: 80,
  phase: "intervention",
});
await fetch(`${apiOrigin}/api/bridges/${stationA.code}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${stationA.writeToken}` },
  body: JSON.stringify(updatedSnapshot),
});
const liveUpdate = await waiting;

const mission = await client.callTool({
  name: "request_station_observation",
  arguments: { expeditionCode, prompt: "Stand by the primary work surface and capture one quiet 10-second baseline." },
});
const eventsResponse = await fetch(`${apiOrigin}/api/bridges/${stationB.code}/events`, {
  headers: { Authorization: `Bearer ${stationB.writeToken}` },
});
const stationEvents = await eventsResponse.json();

assert.equal((comparison.structuredContent as { ready: boolean }).ready, true);
assert.equal((quality.structuredContent as { quality: { confidence: number } }).quality.confidence, 96);
assert.equal((recapture.structuredContent as { delivered: boolean }).delivered, true);
assert.equal((liveUpdate.structuredContent as { timedOut: boolean }).timedOut, false);
assert.equal((mission.structuredContent as { requested: number }).requested, 2);
assert.equal((stationEvents as { events: unknown[] }).events.length, 2);

for (const station of [stationA, stationB]) {
  await fetch(`${apiOrigin}/api/bridges/${station.code}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${station.writeToken}` },
  });
}

console.log(JSON.stringify({
  protocolEra: client.getProtocolEra(),
  server: client.getServerVersion(),
  expeditionCode,
  stations: stations.structuredContent,
  comparison: comparison.structuredContent,
  quality: quality.structuredContent,
  recapture: recapture.structuredContent,
  liveUpdate: liveUpdate.structuredContent,
  mission: mission.structuredContent,
  stationEvents,
}, null, 2));

await client.close();
