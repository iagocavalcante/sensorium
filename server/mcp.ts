import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { compareEnvironmentSamples } from "../shared/environment.js";
import { addBridgeEvent, getBridge } from "./bridge-store.js";
import { bridgeCodeSchema } from "./schemas.js";

const result = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value as Record<string, unknown>,
});

const missingBridge = (bridgeCode: string) => ({
  content: [{
    type: "text" as const,
    text: `No active Sensorium bridge was found for ${bridgeCode}. Ask the person to open an Agent bridge in the Sensorium page.`,
  }],
  isError: true,
});

function buildSensoriumServer() {
  const server = new McpServer(
    { name: "sensorium", version: "0.2.0" },
    { instructions: "Sensorium lets an agent inspect structured environmental evidence that a person intentionally bridges from their browser. Never imply access to raw camera or microphone media; only derived measurements are available." },
  );

  server.registerTool(
    "inspect_sensorium",
    {
      title: "Inspect Sensorium bridge",
      description: "Explain the remote Sensorium collaboration model and the evidence available to MCP clients.",
      annotations: { readOnlyHint: true },
    },
    async () => result({
      service: "Sensorium remote MCP",
      mode: "temporary human-authorized evidence bridge",
      bridgeLifetimeMinutes: 60,
      rawMediaAvailable: false,
      next: "Ask the person for the bridge code shown in Sensorium, then call read_environment.",
    }),
  );

  server.registerTool(
    "read_environment",
    {
      title: "Read bridged environment",
      description: "Read the current investigation and structured environmental samples intentionally shared from a Sensorium browser.",
      inputSchema: z.object({ bridgeCode: bridgeCodeSchema.describe("Temporary bridge code shown in Sensorium.") }),
      annotations: { readOnlyHint: true },
    },
    async ({ bridgeCode }) => {
      const bridge = await getBridge(bridgeCode);
      return bridge ? result({
        bridge: { code: bridge.code, updatedAt: bridge.updatedAt, expiresAt: bridge.expiresAt },
        investigation: bridge.snapshot.investigation,
        requestedObservation: bridge.snapshot.requestedObservation,
        intervention: bridge.snapshot.intervention,
        samples: bridge.snapshot.samples,
        activity: bridge.snapshot.activity,
        privacy: "Structured measurements only; no audio, video, or precise location is stored.",
      }) : missingBridge(bridgeCode);
    },
  );

  server.registerTool(
    "compare_places",
    {
      title: "Compare bridged places",
      description: "Rank the current Sensorium samples using the same habitat scoring model as the browser instrument.",
      inputSchema: z.object({ bridgeCode: bridgeCodeSchema }),
      annotations: { readOnlyHint: true },
    },
    async ({ bridgeCode }) => {
      const bridge = await getBridge(bridgeCode);
      return bridge ? result(compareEnvironmentSamples(bridge.snapshot.samples)) : missingBridge(bridgeCode);
    },
  );

  server.registerTool(
    "annotate_evidence",
    {
      title: "Annotate bridged evidence",
      description: "Send an evidence-grounded interpretation back to the person's visible Sensorium activity ledger.",
      inputSchema: z.object({
        bridgeCode: bridgeCodeSchema,
        text: z.string().trim().min(1).max(500).describe("Concise interpretation grounded in the available measurements."),
      }),
    },
    async ({ bridgeCode, text }) => {
      const event = await addBridgeEvent(bridgeCode, { type: "annotation", text });
      return event ? result({ delivered: true, event, visibility: "The annotation will appear in the browser ledger." }) : missingBridge(bridgeCode);
    },
  );

  server.registerTool(
    "propose_intervention",
    {
      title: "Propose environmental intervention",
      description: "Send one safe, reversible environmental change back to the Sensorium page for the person to test.",
      inputSchema: z.object({
        bridgeCode: bridgeCodeSchema,
        text: z.string().trim().min(1).max(320).describe("One safe, specific, reversible change."),
        rationale: z.string().trim().min(1).max(500).describe("Why the evidence supports this test."),
      }),
    },
    async ({ bridgeCode, text, rationale }) => {
      const event = await addBridgeEvent(bridgeCode, { type: "intervention", text, rationale });
      return event ? result({
        delivered: true,
        event,
        next: "Ask the person to apply the change and capture a verification reading.",
      }) : missingBridge(bridgeCode);
    },
  );

  return server;
}

export const mcpHandler = createMcpHandler(buildSensoriumServer, { responseMode: "json" });
