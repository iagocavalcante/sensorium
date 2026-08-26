# Sensorium — Devpost submission draft

## Tagline

Give your browser agent a way to sense the physical world—without taking the human out of the loop.

## Project links

- Live app: https://sensorium-devsnorte.fly.dev/
- Source: https://github.com/iagocavalcante/sensorium
- Demo video: https://youtu.be/6oQng15Ee9U

## Inspiration

Browser agents can reason, compare, and plan, but they cannot walk across a room, point a camera at a window, or notice that a desk is noisy and dim. Humans can do those things, but we are poor at collecting repeatable measurements and comparing several signals at once.

Sensorium starts from a simple idea: the agent has the mind, the human has the body, and WebMCP is the nervous system between them.

## What it does

Sensorium is a distributed human-agent field laboratory. One person can ask, “Where can our team do its best focused work?” An agent creates a temporary expedition; people in a home office, library, classroom, or studio join as field stations from their browsers. The agent gives every station the same observation mission, waits for live readings, and compares them with a goal-specific scoring profile.

The browser measures relative microphone level and camera-derived brightness only after the person explicitly starts a physical capture. Each physical observation is now an eight-second protocol: Sensorium collects many paired readings, reports medians instead of a fragile instant, measures sound/light variability, checks device movement when available, and assigns a transparent confidence grade. Agents can inspect weak evidence and place a precise recapture mission back into the browser without activating a sensor. A deterministic simulation mode keeps the complete experience easy to evaluate without permission. Every human action, sensor result, quality warning, and agent interpretation appears in one shared evidence ledger.

Sensorium demonstrates how browser-native WebMCP and conventional remote MCP complement each other. WebMCP gives each local agent a structured interface to the live page and its human-controlled sensors. A remote MCP coordinator creates six-hour expeditions, observes temporary station presence, broadcasts standardized physical missions, waits for live updates, and compares readings across locations. Each one-hour station bridge is opt-in and protected by a high-entropy code. Raw audio and video never cross the bridge.

## Why WebMCP is essential

This experience depends on the person and browser agent sharing the same live page, permissions, investigation state, and visible evidence. Remote MCP extends the investigation, but it cannot replace WebMCP: only the page can coordinate the person’s physical movement, direct permission gestures, browser sensors, and immediately inspectable UI.

WebMCP turns Sensorium’s existing application operations into thirteen structured tools:

1. `inspect_capabilities`
2. `create_investigation`
3. `list_goal_profiles`
4. `score_samples_for_goal`
5. `request_observation`
6. `capture_sample`
7. `compare_samples`
8. `validate_sample_quality`
9. `request_recapture`
10. `annotate_evidence`
11. `propose_intervention`
12. `record_outcome`
13. `export_evidence_capsule`

The tools use narrow JSON Schemas, distinguish read-only operations, mark user-controlled evidence as untrusted content, return concise verifiable results, and update the same interface the person is watching.

## How people and agents collaborate

Agents contribute experimental design, consistent protocols, coordination, live comparison, and interpretation. People contribute physical presence in places the agent cannot reach, sensor consent, context, and judgment. A single agent can now coordinate several humans as a temporary scientific instrument; neither side can complete the distributed investigation alone.

For consequential browser capabilities, the agent does not silently activate a sensor. It places a clear mission on the page and returns `needs_user_action`; the person remains responsible for granting permission and starting the reading. This makes human control a visible product feature rather than hidden friction.

## How we built it

Sensorium is a React 19 and TypeScript 7 progressive web app built with Vite. WebMCP tools are registered through `document.modelContext.registerTool`. An external local-first store synchronizes WebMCP calls with React UI state and browser persistence.

Physical readings combine `MediaDevices.getUserMedia`, Web Audio time-domain analysis, repeated video frames, Canvas luminance sampling, Device Motion, and Screen Wake Lock. The app also provides deterministic synthetic readings, an environmental scoring model, a separate evidence-confidence model, intervention comparison, JSON evidence export, responsive layouts, reduced-motion support, and an offline service-worker shell. Browser-derived sound and light are explicitly labeled relative—not calibrated dB or lux.

The production site runs as a Node.js service on Fly.io in São Paulo. The same origin serves the React app, an expiring evidence/expedition API, and a standards-compliant MCP Streamable HTTP endpoint built with the MCP TypeScript SDK v2. An in-process event stream powers long-polling expedition updates, while short-lived random codes replace permanent accounts. The service explicitly sends `Origin-Agent-Cluster: ?1` and a `Permissions-Policy` allowing WebMCP tools and the required first-party sensors. Multi-step journey evals live in `evals/`.

## Challenges we ran into

The hardest design problem was preserving the permission boundary. Camera and microphone APIs require direct human interaction, while an agent expects callable operations. We made that constraint part of the collaboration model: WebMCP can request a physical observation, but only the person can start sensor capture.

We also had to make heterogeneous signals understandable. Sound, brightness, and steadiness have different units and useful ranges, so Sensorium converts them into a transparent habitat score while keeping the raw readings visible.

A favorable number is not automatically good evidence. We therefore keep suitability and confidence separate. Signal variability, capture duration, reading count, and motion quality explain whether the agent should rely on a sample or request a controlled repeat.

Distributed measurement added a second challenge: comparisons are only credible when every station follows the same protocol. Agent-broadcast missions make the procedure visible in every browser, while live update cursors let the coordinator react to new evidence without losing human control.

## Accomplishments we are proud of

- WebMCP is the core collaboration layer rather than a wrapper around a generic form.
- The app connects agent reasoning to real browser sensors while preserving human permission.
- Every agent side effect is visible in the shared evidence board.
- Browser agents and remote MCP clients can collaborate through the same investigation without exposing raw media.
- One remote agent can coordinate multiple human-operated field stations in real time without accounts or permanent tracking.
- The same reading can be evaluated differently for focus, sleep, reading, video calls, or audio recording.
- Weak readings explain their limitations and can trigger a visible, human-authorized recapture protocol.
- The full journey works with deterministic data for reliable judging and with physical capture for a real-world demo.
- The interface has a distinctive field-notebook and scientific-instrument identity.

## What we learned

WebMCP is most compelling when human and agent abilities are asymmetric. The goal is not to let an agent imitate every click. It is to give the agent a small, trustworthy vocabulary for contributing what it does well while keeping the person’s context, consent, and judgment central.

## What is next

Next, Sensorium can support optional Web Bluetooth and Web Serial instruments for CO₂, temperature, air quality, and light sensors. Expedition templates could cover classroom comfort, accessibility field audits, urban heat islands, neighborhood noise, and disaster-response reconnaissance. Evidence capsules could also be cryptographically signed without introducing a permanent data account.

## Suggested judge prompts

1. “Inspect what Sensorium can do and start an investigation to find the best place in this room for focused work.”
2. “Use simulated readings for the desk and window, then compare them.”
3. “Propose one reversible intervention, record a simulated outcome, and explain whether it helped.”
4. “Prepare the current evidence capsule for export.”
5. “Create a focus expedition called Field Desk Atlas and give me the join code.”
6. Join from two browsers, then ask: “List the stations, send everyone the same quiet-baseline mission, wait for the next reading, and compare the stations.”

## Built with

WebMCP, Model Context Protocol, MCP TypeScript SDK v2, Streamable HTTP, React, TypeScript, Vite, Node.js, MediaDevices, Web Audio API, Canvas API, Service Worker, local browser storage, Docker, and Fly.io.
