# Sensorium — Devpost submission draft

## Tagline

Give your browser agent a way to sense the physical world—without taking the human out of the loop.

## Project links

- Live app: https://sensorium-devsnorte.fly.dev/
- Source: https://github.com/iagocavalcante/sensorium
- Demo video: _add public YouTube URL before submission_

## Inspiration

Browser agents can reason, compare, and plan, but they cannot walk across a room, point a camera at a window, or notice that a desk is noisy and dim. Humans can do those things, but we are poor at collecting repeatable measurements and comparing several signals at once.

Sensorium starts from a simple idea: the agent has the mind, the human has the body, and WebMCP is the nervous system between them.

## What it does

Sensorium is a human-agent field laboratory that helps someone investigate a physical environment. A person can ask, “Where in this room can I do my best focused work?” Their browser agent can then create an investigation, request specific human observations, collect structured readings, compare environments, propose a reversible intervention, and verify whether it helped.

The browser measures microphone level and camera-derived brightness only after the person explicitly starts a physical capture. A deterministic simulation mode makes the complete experience easy to evaluate without granting sensor permission. Every human action, sensor result, and agent interpretation appears in one shared evidence ledger.

Sensorium also demonstrates how browser-native WebMCP and conventional remote MCP can complement each other. The person can open a one-hour evidence bridge and give its private code to Codex, Claude, or another MCP client. That client can read and compare structured evidence through a Streamable HTTP MCP endpoint, then send an annotation or reversible intervention back into the live browser ledger. Raw audio and video never cross the bridge.

## Why WebMCP is essential

This experience depends on the person and browser agent sharing the same live page, permissions, investigation state, and visible evidence. Remote MCP extends the investigation, but it cannot replace WebMCP: only the page can coordinate the person’s physical movement, direct permission gestures, browser sensors, and immediately inspectable UI.

WebMCP turns Sensorium’s existing application operations into nine structured tools:

1. `inspect_capabilities`
2. `create_investigation`
3. `request_observation`
4. `capture_sample`
5. `compare_samples`
6. `annotate_evidence`
7. `propose_intervention`
8. `record_outcome`
9. `export_evidence_capsule`

The tools use narrow JSON Schemas, distinguish read-only operations, mark user-controlled evidence as untrusted content, return concise verifiable results, and update the same interface the person is watching.

## How people and agents collaborate

The agent contributes experimental design, consistency, comparison, and interpretation. The person contributes physical movement, consent, context, and judgment. Neither side can complete the investigation as effectively alone.

For consequential browser capabilities, the agent does not silently activate a sensor. It places a clear mission on the page and returns `needs_user_action`; the person remains responsible for granting permission and starting the reading. This makes human control a visible product feature rather than hidden friction.

## How we built it

Sensorium is a React 19 and TypeScript 7 progressive web app built with Vite. WebMCP tools are registered through `document.modelContext.registerTool`. An external local-first store synchronizes WebMCP calls with React UI state and browser persistence.

Physical readings combine `MediaDevices.getUserMedia`, Web Audio time-domain analysis, video frames, and Canvas luminance sampling. The app also provides deterministic synthetic readings, an environmental scoring model, intervention comparison, JSON evidence export, responsive layouts, reduced-motion support, and an offline service-worker shell.

The production site runs as a Node.js service on Fly.io in São Paulo. The same origin serves the React app, an expiring evidence-bridge API, and a standards-compliant MCP Streamable HTTP endpoint built with the MCP TypeScript SDK v2. It explicitly sends `Origin-Agent-Cluster: ?1` and a `Permissions-Policy` allowing WebMCP tools and the required first-party sensors. Initial multi-step agent journey evals live in `evals/webmcp-journeys.json`.

## Challenges we ran into

The hardest design problem was preserving the permission boundary. Camera and microphone APIs require direct human interaction, while an agent expects callable operations. We made that constraint part of the collaboration model: WebMCP can request a physical observation, but only the person can start sensor capture.

We also had to make heterogeneous signals understandable. Sound, brightness, and steadiness have different units and useful ranges, so Sensorium converts them into a transparent habitat score while keeping the raw readings visible.

## Accomplishments we are proud of

- WebMCP is the core collaboration layer rather than a wrapper around a generic form.
- The app connects agent reasoning to real browser sensors while preserving human permission.
- Every agent side effect is visible in the shared evidence board.
- Browser agents and remote MCP clients can collaborate through the same investigation without exposing raw media.
- The full journey works with deterministic data for reliable judging and with physical capture for a real-world demo.
- The interface has a distinctive field-notebook and scientific-instrument identity.

## What we learned

WebMCP is most compelling when human and agent abilities are asymmetric. The goal is not to let an agent imitate every click. It is to give the agent a small, trustworthy vocabulary for contributing what it does well while keeping the person’s context, consent, and judgment central.

## What is next

Next, Sensorium can support optional Web Bluetooth and Web Serial instruments for CO₂, temperature, air quality, and light sensors. Other investigation templates could cover sleep environments, classroom comfort, accessibility field audits, urban heat, and citizen science. Evidence capsules could also be cryptographically signed and shared between nearby field stations without introducing a permanent data account.

## Suggested judge prompts

1. “Inspect what Sensorium can do and start an investigation to find the best place in this room for focused work.”
2. “Use simulated readings for the desk and window, then compare them.”
3. “Propose one reversible intervention, record a simulated outcome, and explain whether it helped.”
4. “Prepare the current evidence capsule for export.”
5. Open the Remote MCP bridge, connect an MCP client, and ask it to compare the places and send one intervention back to the browser.

## Built with

WebMCP, Model Context Protocol, MCP TypeScript SDK v2, Streamable HTTP, React, TypeScript, Vite, Node.js, MediaDevices, Web Audio API, Canvas API, Service Worker, local browser storage, Docker, and Fly.io.
