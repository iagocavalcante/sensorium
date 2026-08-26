import type { EnvironmentSnapshot } from "../../shared/environment";

export type AgentBridge = {
  code: string;
  writeToken: string;
  expiresAt: string;
  mcpUrl: string;
};

export type AgentBridgeEvent = {
  id: string;
  at: string;
  type: "annotation" | "intervention";
  text: string;
  rationale?: string;
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The agent bridge could not be reached.");
  return body as T;
}

export function createAgentBridge(snapshot: EnvironmentSnapshot) {
  return api<AgentBridge>("/api/bridges", { method: "POST", body: JSON.stringify(snapshot) });
}

export function syncAgentBridge(bridge: AgentBridge, snapshot: EnvironmentSnapshot) {
  return api<{ updated: boolean }>(`/api/bridges/${encodeURIComponent(bridge.code)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${bridge.writeToken}` },
    body: JSON.stringify(snapshot),
  });
}

export function closeAgentBridge(bridge: AgentBridge) {
  return api<{ deleted: boolean }>(`/api/bridges/${encodeURIComponent(bridge.code)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${bridge.writeToken}` },
  });
}

export function readAgentBridgeEvents(bridge: AgentBridge, after?: string) {
  const query = after ? `?after=${encodeURIComponent(after)}` : "";
  return api<{ events: AgentBridgeEvent[] }>(`/api/bridges/${encodeURIComponent(bridge.code)}/events${query}`, {
    headers: { Authorization: `Bearer ${bridge.writeToken}` },
  });
}

export function bridgeConnectionBrief(bridge: AgentBridge) {
  return [
    "Connect to the Sensorium MCP server:",
    bridge.mcpUrl,
    "",
    `Bridge code: ${bridge.code}`,
    "First call inspect_sensorium, then read_environment with this bridge code.",
  ].join("\n");
}
