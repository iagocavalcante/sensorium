import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { compareEnvironmentSamples, goalProfiles, sampleEvidenceQuality } from "../shared/environment.js";
import {
  addBridgeEvent,
  compareBridgeSamples,
  compareExpeditionStations,
  createExpedition,
  getBridge,
  getExpedition,
  listExpeditionStations,
  requestExpeditionObservation,
  waitForExpeditionUpdate,
} from "./bridge-store.js";
import { bridgeCodeSchema, expeditionCodeSchema, goalProfileSchema } from "./schemas.js";

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

const missingExpedition = (expeditionCode: string) => ({
  content: [{
    type: "text" as const,
    text: `No active Sensorium expedition was found for ${expeditionCode}. Create a new expedition or confirm the six-hour code.`,
  }],
  isError: true,
});

function buildSensoriumServer() {
  const server = new McpServer(
    { name: "sensorium", version: "0.4.0" },
    { instructions: "Sensorium coordinates human-authorized environmental fieldwork. Browser stations control sensors and physical action; MCP agents may design missions, compare structured evidence, and return visible findings. Never imply access to raw camera or microphone media." },
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
      expeditionLifetimeHours: 6,
      rawMediaAvailable: false,
      collaborationModes: ["single human-authorized bridge", "multi-station expedition"],
      evidenceProtocol: "Eight-second multi-reading capture with variability, duration, and device-motion quality checks.",
      calibration: "Browser-derived sound and light are relative signals, not calibrated dB or lux.",
      next: "Read a bridge code, or create an expedition and invite browser stations to join it.",
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
        bridge: {
          code: bridge.code,
          stationLabel: bridge.stationLabel,
          expeditionCode: bridge.expeditionCode,
          updatedAt: bridge.updatedAt,
          expiresAt: bridge.expiresAt,
        },
        investigation: bridge.snapshot.investigation,
        requestedObservation: bridge.snapshot.requestedObservation,
        intervention: bridge.snapshot.intervention,
        samples: bridge.snapshot.samples,
        activity: bridge.snapshot.activity,
        privacy: "Structured measurements only; no audio, video, or precise location is stored.",
        calibration: "soundDb is a legacy field name containing a relative 0–100 sound signal; brightness is relative camera luminance, not lux.",
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
    "list_goal_profiles",
    {
      title: "List environmental goals",
      description: "List the goal-specific scoring profiles Sensorium can apply to the same physical evidence.",
      annotations: { readOnlyHint: true },
    },
    async () => result({ profiles: goalProfiles }),
  );

  server.registerTool(
    "score_environment_for_goal",
    {
      title: "Score environment for a goal",
      description: "Re-score every sample in one bridge for focus, sleep, reading, video calls, or recording.",
      inputSchema: z.object({ bridgeCode: bridgeCodeSchema, profile: goalProfileSchema }),
      annotations: { readOnlyHint: true },
    },
    async ({ bridgeCode, profile }) => {
      const comparison = await compareBridgeSamples(bridgeCode, profile);
      return comparison ? result(comparison) : missingBridge(bridgeCode);
    },
  );

  server.registerTool(
    "create_expedition",
    {
      title: "Create field expedition",
      description: "Create a six-hour multi-station investigation that browser participants can join with an expedition code.",
      inputSchema: z.object({
        title: z.string().trim().min(1).max(120),
        question: z.string().trim().min(1).max(500),
        profile: goalProfileSchema,
      }),
      annotations: { idempotentHint: false, openWorldHint: false },
    },
    async ({ title, question, profile }) => result({
      expedition: await createExpedition(title, question, profile),
      instructions: "Share the expedition code with participants. Each person enters it under Join an expedition before opening their Sensorium bridge.",
    }),
  );

  server.registerTool(
    "validate_sample_quality",
    {
      title: "Validate bridged evidence quality",
      description: "Inspect confidence, duration, reading count, signal variability, and motion validation for one bridged sample. Uses the latest sample when no ID is supplied.",
      inputSchema: z.object({
        bridgeCode: bridgeCodeSchema,
        sampleId: z.string().max(160).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ bridgeCode, sampleId }) => {
      const bridge = await getBridge(bridgeCode);
      if (!bridge) return missingBridge(bridgeCode);
      const sample = sampleId
        ? bridge.snapshot.samples.find((candidate) => candidate.id === sampleId)
        : bridge.snapshot.samples.at(-1);
      return sample ? result({
        sample: { id: sample.id, label: sample.label, source: sample.source },
        quality: sampleEvidenceQuality(sample),
        units: "Sound and light are relative browser-derived signals, not calibrated dB or lux.",
      }) : result({ status: "no_sample", next: "Ask the person to run the eight-second field protocol." });
    },
  );

  server.registerTool(
    "request_bridge_recapture",
    {
      title: "Request cleaner bridged evidence",
      description: "Send a visible eight-second recapture mission to one browser bridge when its evidence is not reliable enough for comparison.",
      inputSchema: z.object({
        bridgeCode: bridgeCodeSchema,
        sampleId: z.string().max(160).optional(),
        reason: z.string().trim().min(1).max(320),
      }),
      annotations: { openWorldHint: false },
    },
    async ({ bridgeCode, sampleId, reason }) => {
      const bridge = await getBridge(bridgeCode);
      if (!bridge) return missingBridge(bridgeCode);
      const sample = sampleId
        ? bridge.snapshot.samples.find((candidate) => candidate.id === sampleId)
        : bridge.snapshot.samples.at(-1);
      if (!sample) return result({ delivered: false, reason: "No sample is available to recapture." });
      const prompt = `Repeat “${sample.label}” with the phone resting in the same position for the full eight-second protocol. ${reason}`;
      const event = await addBridgeEvent(bridgeCode, { type: "observation_request", text: prompt });
      return event ? result({ delivered: true, event, sampleId: sample.id, humanActionRequired: true }) : missingBridge(bridgeCode);
    },
  );

  server.registerTool(
    "list_field_stations",
    {
      title: "List field stations",
      description: "List the live browser stations participating in a Sensorium expedition and their latest sample metadata.",
      inputSchema: z.object({ expeditionCode: expeditionCodeSchema }),
      annotations: { readOnlyHint: true },
    },
    async ({ expeditionCode }) => {
      const expedition = await getExpedition(expeditionCode);
      if (!expedition) return missingExpedition(expeditionCode);
      return result({ expedition, stations: await listExpeditionStations(expeditionCode) });
    },
  );

  server.registerTool(
    "request_station_observation",
    {
      title: "Request field observation",
      description: "Send one clear physical measurement mission to every live station, or to one station. The request becomes visible in each browser and still requires human action.",
      inputSchema: z.object({
        expeditionCode: expeditionCodeSchema,
        stationCode: bridgeCodeSchema.optional().describe("Omit to send the same standardized mission to every station."),
        prompt: z.string().trim().min(1).max(500).describe("One concise, safe physical observation request."),
      }),
      annotations: { openWorldHint: false },
    },
    async ({ expeditionCode, stationCode, prompt }) => {
      const delivery = await requestExpeditionObservation(expeditionCode, prompt, stationCode);
      return delivery ? result({ ...delivery, prompt, humanActionRequired: true }) : missingExpedition(expeditionCode);
    },
  );

  server.registerTool(
    "compare_stations",
    {
      title: "Compare field stations",
      description: "Rank the latest reading from every live station using the expedition goal or an explicitly selected profile.",
      inputSchema: z.object({ expeditionCode: expeditionCodeSchema, profile: goalProfileSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ expeditionCode, profile }) => {
      const comparison = await compareExpeditionStations(expeditionCode, profile);
      return comparison ? result(comparison) : missingExpedition(expeditionCode);
    },
  );

  server.registerTool(
    "await_expedition_update",
    {
      title: "Wait for field update",
      description: "Wait for the next station join, sample, mission, or finding in an expedition. Pass the returned cursor to wait for a newer update.",
      inputSchema: z.object({
        expeditionCode: expeditionCodeSchema,
        afterEventId: z.string().max(32).optional(),
        timeoutSeconds: z.number().int().min(1).max(25).default(20),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ expeditionCode, afterEventId, timeoutSeconds }) => {
      const update = await waitForExpeditionUpdate(expeditionCode, afterEventId, timeoutSeconds * 1000);
      return update ? result(update) : missingExpedition(expeditionCode);
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
