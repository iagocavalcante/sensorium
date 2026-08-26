import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  compareEnvironmentSamples,
  goalProfiles,
  sampleEvidenceQuality,
  scoreEnvironmentSample,
  type EnvironmentSnapshot,
  type GoalProfile,
} from "../shared/environment.js";

export type BridgeEvent = {
  id: string;
  at: string;
  type: "annotation" | "intervention" | "observation_request";
  text: string;
  rationale?: string;
};

export type ExpeditionUpdate = {
  id: string;
  at: string;
  type: "expedition_created" | "station_joined" | "station_left" | "sample_captured" | "mission_sent" | "agent_finding";
  stationCode?: string;
  stationLabel?: string;
  text: string;
};

type BridgeRecord = {
  code: string;
  writeToken: string;
  stationLabel: string;
  expeditionCode?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  snapshot: EnvironmentSnapshot;
  events: BridgeEvent[];
};

type ExpeditionRecord = {
  code: string;
  title: string;
  question: string;
  profile: GoalProfile;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  updates: ExpeditionUpdate[];
};

type PersistedStore = { bridges: BridgeRecord[]; expeditions: ExpeditionRecord[] };

const BRIDGE_TTL_MS = 60 * 60 * 1000;
const EXPEDITION_TTL_MS = 6 * 60 * 60 * 1000;
const storePath = process.env.BRIDGE_STORE_PATH ?? path.resolve(".sensorium-bridges.json");
const bridges = new Map<string, BridgeRecord>();
const expeditions = new Map<string, ExpeditionRecord>();
const updateEmitter = new EventEmitter();
updateEmitter.setMaxListeners(200);
let loaded = false;
let writeQueue = Promise.resolve();

const token = (bytes: number) => randomBytes(bytes).toString("base64url");

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const persisted = JSON.parse(await readFile(storePath, "utf8")) as Partial<PersistedStore>;
    for (const bridge of persisted.bridges ?? []) {
      bridges.set(bridge.code, { ...bridge, stationLabel: bridge.stationLabel || "Field station" });
    }
    for (const expedition of persisted.expeditions ?? []) expeditions.set(expedition.code, expedition);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[bridge] store load failed", error);
  }
  await cleanup();
}

async function persist() {
  const snapshot = JSON.stringify({
    bridges: [...bridges.values()],
    expeditions: [...expeditions.values()],
  } satisfies PersistedStore);
  writeQueue = writeQueue.then(async () => {
    await mkdir(path.dirname(storePath), { recursive: true });
    const temporaryPath = `${storePath}.tmp`;
    await writeFile(temporaryPath, snapshot, { mode: 0o600 });
    await rename(temporaryPath, storePath);
  });
  await writeQueue;
}

async function cleanup() {
  const now = Date.now();
  let changed = false;
  for (const [code, bridge] of bridges) {
    if (Date.parse(bridge.expiresAt) <= now) {
      bridges.delete(code);
      changed = true;
    }
  }
  for (const [code, expedition] of expeditions) {
    if (Date.parse(expedition.expiresAt) <= now) {
      expeditions.delete(code);
      changed = true;
    }
  }
  if (changed) await persist();
}

function publicBridge(bridge: BridgeRecord) {
  return {
    code: bridge.code,
    stationLabel: bridge.stationLabel,
    expeditionCode: bridge.expeditionCode,
    createdAt: bridge.createdAt,
    updatedAt: bridge.updatedAt,
    expiresAt: bridge.expiresAt,
    snapshot: bridge.snapshot,
    events: bridge.events,
  };
}

function publicExpedition(expedition: ExpeditionRecord) {
  return {
    code: expedition.code,
    title: expedition.title,
    question: expedition.question,
    profile: expedition.profile,
    goal: goalProfiles[expedition.profile],
    createdAt: expedition.createdAt,
    updatedAt: expedition.updatedAt,
    expiresAt: expedition.expiresAt,
    latestUpdate: expedition.updates.at(-1),
  };
}

function pushExpeditionUpdate(expeditionCode: string, update: Omit<ExpeditionUpdate, "id" | "at">) {
  const expedition = expeditions.get(expeditionCode);
  if (!expedition) return undefined;
  const complete: ExpeditionUpdate = { ...update, id: token(10), at: new Date().toISOString() };
  expedition.updatedAt = complete.at;
  expedition.updates.push(complete);
  if (expedition.updates.length > 500) expedition.updates.splice(0, expedition.updates.length - 500);
  updateEmitter.emit(expeditionCode, complete);
  return complete;
}

export async function createExpedition(title: string, question: string, profile: GoalProfile) {
  await load();
  await cleanup();
  const now = new Date();
  const expedition: ExpeditionRecord = {
    code: token(9),
    title,
    question,
    profile,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EXPEDITION_TTL_MS).toISOString(),
    updates: [],
  };
  expeditions.set(expedition.code, expedition);
  pushExpeditionUpdate(expedition.code, { type: "expedition_created", text: `Expedition opened: ${title}.` });
  await persist();
  return publicExpedition(expedition);
}

export async function getExpedition(code: string) {
  await load();
  await cleanup();
  const expedition = expeditions.get(code);
  return expedition ? publicExpedition(expedition) : undefined;
}

export async function createBridge(
  snapshot: EnvironmentSnapshot,
  options: { stationLabel?: string; expeditionCode?: string } = {},
) {
  await load();
  await cleanup();
  if (options.expeditionCode && !expeditions.has(options.expeditionCode)) {
    throw new Error("That expedition is unavailable or has expired.");
  }
  const now = new Date();
  const bridge: BridgeRecord = {
    code: token(12),
    writeToken: token(24),
    stationLabel: options.stationLabel?.trim() || "Field station",
    expeditionCode: options.expeditionCode,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + BRIDGE_TTL_MS).toISOString(),
    snapshot,
    events: [],
  };
  bridges.set(bridge.code, bridge);
  if (bridge.expeditionCode) {
    pushExpeditionUpdate(bridge.expeditionCode, {
      type: "station_joined",
      stationCode: bridge.code,
      stationLabel: bridge.stationLabel,
      text: `${bridge.stationLabel} joined with ${snapshot.samples.length} existing sample${snapshot.samples.length === 1 ? "" : "s"}.`,
    });
  }
  await persist();
  return {
    ...publicBridge(bridge),
    writeToken: bridge.writeToken,
    expedition: bridge.expeditionCode ? publicExpedition(expeditions.get(bridge.expeditionCode)!) : undefined,
  };
}

export async function getBridge(code: string) {
  await load();
  await cleanup();
  const bridge = bridges.get(code);
  return bridge ? publicBridge(bridge) : undefined;
}

export async function updateBridge(code: string, writeToken: string, snapshot: EnvironmentSnapshot) {
  await load();
  const bridge = bridges.get(code);
  if (!bridge || bridge.writeToken !== writeToken || Date.parse(bridge.expiresAt) <= Date.now()) return false;
  const previousIds = new Set(bridge.snapshot.samples.map((sample) => sample.id));
  const added = snapshot.samples.filter((sample) => !previousIds.has(sample.id));
  bridge.snapshot = snapshot;
  bridge.updatedAt = new Date().toISOString();
  if (bridge.expeditionCode) {
    for (const sample of added) {
      pushExpeditionUpdate(bridge.expeditionCode, {
        type: "sample_captured",
        stationCode: bridge.code,
        stationLabel: bridge.stationLabel,
        text: `${bridge.stationLabel} captured ${sample.label}.`,
      });
    }
  }
  await persist();
  return true;
}

export async function deleteBridge(code: string, writeToken: string) {
  await load();
  const bridge = bridges.get(code);
  if (!bridge || bridge.writeToken !== writeToken) return false;
  if (bridge.expeditionCode) {
    pushExpeditionUpdate(bridge.expeditionCode, {
      type: "station_left",
      stationCode: bridge.code,
      stationLabel: bridge.stationLabel,
      text: `${bridge.stationLabel} closed its bridge.`,
    });
  }
  bridges.delete(code);
  await persist();
  return true;
}

export async function addBridgeEvent(code: string, event: Omit<BridgeEvent, "id" | "at">) {
  await load();
  const bridge = bridges.get(code);
  if (!bridge || Date.parse(bridge.expiresAt) <= Date.now()) return undefined;
  const complete: BridgeEvent = { ...event, id: token(10), at: new Date().toISOString() };
  bridge.events.push(complete);
  bridge.updatedAt = complete.at;
  if (bridge.expeditionCode) {
    pushExpeditionUpdate(bridge.expeditionCode, {
      type: event.type === "observation_request" ? "mission_sent" : "agent_finding",
      stationCode: bridge.code,
      stationLabel: bridge.stationLabel,
      text: `${bridge.stationLabel}: ${event.text}`,
    });
  }
  await persist();
  return complete;
}

export async function getBridgeEvents(code: string, writeToken: string, after?: string) {
  await load();
  const bridge = bridges.get(code);
  if (!bridge || bridge.writeToken !== writeToken || Date.parse(bridge.expiresAt) <= Date.now()) return undefined;
  if (!after) return bridge.events;
  const cursor = Date.parse(after);
  return bridge.events.filter((event) => Date.parse(event.at) > cursor);
}

export async function listExpeditionStations(expeditionCode: string) {
  await load();
  await cleanup();
  const expedition = expeditions.get(expeditionCode);
  if (!expedition || Date.parse(expedition.expiresAt) <= Date.now()) return undefined;
  return [...bridges.values()]
    .filter((bridge) => bridge.expeditionCode === expeditionCode && Date.parse(bridge.expiresAt) > Date.now())
    .map((bridge) => ({
      code: bridge.code,
      label: bridge.stationLabel,
      updatedAt: bridge.updatedAt,
      expiresAt: bridge.expiresAt,
      sampleCount: bridge.snapshot.samples.length,
      latestSample: bridge.snapshot.samples.at(-1),
    }));
}

export async function compareExpeditionStations(expeditionCode: string, requestedProfile?: GoalProfile) {
  const expedition = await getExpedition(expeditionCode);
  if (!expedition) return undefined;
  const profile = requestedProfile ?? expedition.profile;
  const stations = await listExpeditionStations(expeditionCode);
  const ranked = (stations ?? [])
    .filter((station) => station.latestSample)
    .map((station) => {
      const sample = station.latestSample!;
      const quality = sampleEvidenceQuality(sample);
      return {
        stationCode: station.code,
        stationLabel: station.label,
        sample,
        score: scoreEnvironmentSample(sample, profile),
        confidence: quality.confidence,
        qualityGrade: quality.grade,
        recaptureRecommended: quality.recaptureRecommended,
      };
    })
    .sort((a, b) => b.score - a.score);
  const needsRecapture = ranked.filter((station) => station.recaptureRecommended);
  return {
    expedition,
    profile,
    goal: goalProfiles[profile],
    ready: ranked.length >= 2 && needsRecapture.length === 0,
    enoughStations: ranked.length >= 2,
    caution: needsRecapture.length ? `${needsRecapture.length} station${needsRecapture.length === 1 ? " needs" : "s need"} cleaner evidence before a confident comparison.` : undefined,
    ranked,
    best: ranked[0],
  };
}

export async function requestExpeditionObservation(expeditionCode: string, prompt: string, stationCode?: string) {
  const stations = await listExpeditionStations(expeditionCode);
  if (!stations) return undefined;
  const targets = stationCode ? stations.filter((station) => station.code === stationCode) : stations;
  const delivered = [];
  for (const station of targets) {
    const event = await addBridgeEvent(station.code, { type: "observation_request", text: prompt });
    if (event) delivered.push({ stationCode: station.code, stationLabel: station.label, eventId: event.id });
  }
  return { delivered, requested: targets.length };
}

export async function waitForExpeditionUpdate(expeditionCode: string, afterEventId?: string, timeoutMs = 20_000) {
  await load();
  await cleanup();
  const expedition = expeditions.get(expeditionCode);
  if (!expedition || Date.parse(expedition.expiresAt) <= Date.now()) return undefined;

  const afterIndex = afterEventId ? expedition.updates.findIndex((update) => update.id === afterEventId) : -1;
  const existing = afterEventId
    ? expedition.updates[afterIndex >= 0 ? afterIndex + 1 : expedition.updates.length - 1]
    : expedition.updates.at(-1);
  if (existing) return { update: existing, cursor: existing.id, timedOut: false };

  return await new Promise<{ update?: ExpeditionUpdate; cursor?: string; timedOut: boolean }>((resolve) => {
    const onUpdate = (update: ExpeditionUpdate) => {
      clearTimeout(timeout);
      resolve({ update, cursor: update.id, timedOut: false });
    };
    const timeout = setTimeout(() => {
      updateEmitter.off(expeditionCode, onUpdate);
      resolve({ cursor: afterEventId, timedOut: true });
    }, Math.min(Math.max(timeoutMs, 1_000), 25_000));
    updateEmitter.once(expeditionCode, onUpdate);
  });
}

export async function compareBridgeSamples(code: string, profile: GoalProfile) {
  const bridge = await getBridge(code);
  return bridge ? compareEnvironmentSamples(bridge.snapshot.samples, profile) : undefined;
}
