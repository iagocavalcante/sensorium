# Sensorium

**A browser field laboratory where the agent has the mind, the human has the body, and WebMCP is the nervous system.**

Sensorium lets a person and their browser agent investigate a physical environment together. The person supplies movement, perception, and permission. The agent supplies experimental structure, comparison, and interpretation. Both work in the same visible evidence board.

## What already works

- Nine imperative WebMCP tools registered through `document.modelContext.registerTool`
- Real camera brightness and microphone-level capture after explicit human permission
- Simulated readings for deterministic demonstrations
- Environmental fingerprint comparison and intervention verification
- Local browser persistence and JSON evidence export
- Installable, offline-capable PWA shell
- Responsive, reduced-motion-aware interface
- Initial multi-step WebMCP journey evals in `evals/webmcp-journeys.json`

## WebMCP tools

`inspect_capabilities`, `create_investigation`, `request_observation`, `capture_sample`, `compare_samples`, `annotate_evidence`, `propose_intervention`, `record_outcome`, and `export_evidence_capsule`.

## Run locally

```bash
npm install
npm run dev
```

Enable WebMCP in Chrome at `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, then open the local URL. Camera and microphone access require a secure context; `localhost` is treated as secure by modern browsers.

## Production build

```bash
npm run build
```

## Privacy model

Sensor readings remain in the browser. Sensorium does not require an account or an AI API key. Physical camera and microphone capture only begins after the person presses the capture button, and media tracks are stopped immediately after sampling.

## License

[MIT](./LICENSE)
