# Sensorium

**A browser field laboratory where the agent has the mind, the human has the body, and WebMCP is the nervous system.**

Sensorium lets people and their agents investigate physical environments together—even when those people are in different places. A person supplies movement, perception, and permission. A browser agent uses WebMCP to structure each live experiment; remote MCP agents can coordinate temporary multi-station expeditions. Every mission, reading, and finding returns to the visible evidence board.

## Live app

https://sensorium-devsnorte.fly.dev/

## What already works

- Eleven imperative WebMCP tools registered through `document.modelContext.registerTool`
- Twelve remote MCP tools served through a standards-compliant Streamable HTTP endpoint
- One-hour, opt-in evidence bridges with high-entropy codes and automatic expiry
- Six-hour expeditions that coordinate independent browsers without accounts
- Live agent missions, station presence, and goal-specific comparison across locations
- Bidirectional collaboration: remote agent findings return to the visible browser ledger
- Real camera brightness and microphone-level capture after explicit human permission
- Simulated readings for deterministic demonstrations
- Environmental fingerprint comparison and intervention verification
- Local browser persistence and JSON evidence export
- Installable, offline-capable PWA shell
- Responsive, reduced-motion-aware interface
- Initial multi-step WebMCP journey evals in `evals/webmcp-journeys.json`

## WebMCP tools

`inspect_capabilities`, `create_investigation`, `list_goal_profiles`, `score_samples_for_goal`, `request_observation`, `capture_sample`, `compare_samples`, `annotate_evidence`, `propose_intervention`, `record_outcome`, and `export_evidence_capsule`.

## Remote MCP tools

The production Streamable HTTP endpoint is:

```text
https://sensorium-devsnorte.fly.dev/mcp
```

It exposes:

- Single-station tools: `inspect_sensorium`, `read_environment`, `compare_places`, `annotate_evidence`, and `propose_intervention`
- Goal tools: `list_goal_profiles` and `score_environment_for_goal`
- Expedition tools: `create_expedition`, `list_field_stations`, `request_station_observation`, `compare_stations`, and `await_expedition_update`

Open **Remote MCP bridge** in the Sensorium page to create a temporary bridge code. The code is required to read or change the bridged investigation. A client can then connect to the endpoint and use the code with the tools above.

For a distributed expedition, an agent first calls `create_expedition`. People at different locations enter the resulting expedition code when opening their bridges. The agent can see which stations are present, give every participant the same physical observation mission, wait for new evidence without polling blindly, and rank the latest readings for focus, sleep, reading, video calls, or recording.

The bridge is deliberately asymmetric:

- Sensor permission and raw media stay in the browser.
- Only derived measurements, investigation text, and the visible activity ledger are bridged.
- Remote annotations and interventions flow back into the browser ledger.
- Observation requests are visible missions; the human still performs and authorizes capture.
- A bridge expires after one hour and can be closed immediately by the person.
- An expedition expires after six hours and contains only temporary structured station data.

## Run locally

```bash
npm install
npm run dev
```

For bridge development, run the server in a second terminal:

```bash
npm run dev:server
```

Vite proxies `/api`, `/mcp`, and `/healthz` to the local server. For a production-style local run:

```bash
npm run build
npm start
```

Enable WebMCP in Chrome at `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, then open the local URL. Camera and microphone access require a secure context; `localhost` is treated as secure by modern browsers.

## Production build

```bash
npm run build
```

After opening a bridge in the page, smoke-test a local or deployed MCP endpoint with:

```bash
npm run test:mcp -- https://sensorium-devsnorte.fly.dev/mcp YOUR_BRIDGE_CODE
```

Run the complete disposable two-station expedition test with:

```bash
npm run test:expedition -- https://sensorium-devsnorte.fly.dev/mcp
```

## Deploy to Fly.io

The included `Dockerfile` and `fly.toml` deploy one Node.js service that serves the production web app, temporary bridge API, and MCP endpoint. It sends the isolation and permissions headers required by WebMCP.

```bash
flyctl deploy
```

## Privacy model

Sensorium does not require an account or AI API key. Physical camera and microphone capture only begins after the person presses the capture button, and media tracks are stopped immediately after sampling.

By default, sensor readings remain in the browser. Opening a remote bridge is an explicit opt-in that temporarily sends only the structured investigation snapshot to the Sensorium server. Joining an expedition additionally shares the chosen station label and derived readings with anyone holding that high-entropy expedition code. No raw audio or video is uploaded. Bridge data expires after one hour, expeditions after six hours, and closing a bridge deletes its station data immediately.

## License

[MIT](./LICENSE)
