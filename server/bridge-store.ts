import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EnvironmentSnapshot } from "../shared/environment.js";

export type BridgeEvent = {
  id: string;
  at: string;
  type: "annotation" | "intervention";
  text: string;
  rationale?: string;
};

type BridgeRecord = {
  code: string;
  writeToken: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  snapshot: EnvironmentSnapshot;
  events: BridgeEvent[];
};

type PersistedStore = { bridges: BridgeRecord[] };

const BRIDGE_TTL_MS = 60 * 60 * 1000;
const storePath = process.env.BRIDGE_STORE_PATH ?? path.resolve(".sensorium-bridges.json");
const bridges = new Map<string, BridgeRecord>();
let loaded = false;
let writeQueue = Promise.resolve();

const token = (bytes: number) => randomBytes(bytes).toString("base64url");

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const persisted = JSON.parse(await readFile(storePath, "utf8")) as PersistedStore;
    for (const bridge of persisted.bridges ?? []) bridges.set(bridge.code, bridge);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[bridge] store load failed", error);
  }
  await cleanup();
}

async function persist() {
  const snapshot = JSON.stringify({ bridges: [...bridges.values()] } satisfies PersistedStore);
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
  if (changed) await persist();
}

function publicRecord(bridge: BridgeRecord) {
  return {
    code: bridge.code,
    createdAt: bridge.createdAt,
    updatedAt: bridge.updatedAt,
    expiresAt: bridge.expiresAt,
    snapshot: bridge.snapshot,
    events: bridge.events,
  };
}

export async function createBridge(snapshot: EnvironmentSnapshot) {
  await load();
  const now = new Date();
  const bridge: BridgeRecord = {
    code: token(12),
    writeToken: token(24),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + BRIDGE_TTL_MS).toISOString(),
    snapshot,
    events: [],
  };
  bridges.set(bridge.code, bridge);
  await persist();
  return { ...publicRecord(bridge), writeToken: bridge.writeToken };
}

export async function getBridge(code: string) {
  await load();
  await cleanup();
  const bridge = bridges.get(code);
  return bridge ? publicRecord(bridge) : undefined;
}

export async function updateBridge(code: string, writeToken: string, snapshot: EnvironmentSnapshot) {
  await load();
  const bridge = bridges.get(code);
  if (!bridge || bridge.writeToken !== writeToken || Date.parse(bridge.expiresAt) <= Date.now()) return false;
  bridge.snapshot = snapshot;
  bridge.updatedAt = new Date().toISOString();
  await persist();
  return true;
}

export async function deleteBridge(code: string, writeToken: string) {
  await load();
  const bridge = bridges.get(code);
  if (!bridge || bridge.writeToken !== writeToken) return false;
  bridges.delete(code);
  await persist();
  return true;
}

export async function addBridgeEvent(
  code: string,
  event: Omit<BridgeEvent, "id" | "at">,
) {
  await load();
  const bridge = bridges.get(code);
  if (!bridge || Date.parse(bridge.expiresAt) <= Date.now()) return undefined;
  const complete: BridgeEvent = { ...event, id: token(10), at: new Date().toISOString() };
  bridge.events.push(complete);
  bridge.updatedAt = complete.at;
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
