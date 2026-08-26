import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  bridgeConnectionBrief,
  closeAgentBridge,
  createAgentBridge,
  readAgentBridgeEvents,
  syncAgentBridge,
  type AgentBridge,
} from "./lib/bridge";
import { capturePhysicalReading } from "./lib/sensors";
import { compareSamples, habitatScore, sensoriumStore, type Sample } from "./lib/store";
import { registerSensoriumTools } from "./lib/webmcp";

const formatTime = (iso: string) => new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function Instrument({ samples }: { samples: Sample[] }) {
  const latest = samples.at(-1);
  const score = latest ? habitatScore(latest) : 0;
  return (
    <div className="instrument" aria-label={latest ? `Latest habitat score ${score} out of 100` : "Instrument waiting for a sample"}>
      <div className="instrument-rings" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}>
        <div className="instrument-core">
          <span className="instrument-kicker">habitat</span>
          <strong>{latest ? score : "—"}</strong>
          <span>{latest ? "index" : "awaiting signal"}</span>
        </div>
      </div>
      <div className="instrument-caption">
        <span>sound <b>{latest ? `${latest.soundDb} dB` : "—"}</b></span>
        <span>light <b>{latest ? `${latest.brightness}%` : "—"}</b></span>
        <span>steady <b>{latest ? `${latest.steadiness}%` : "—"}</b></span>
      </div>
    </div>
  );
}

function EvidencePlot({ samples }: { samples: Sample[] }) {
  if (!samples.length) {
    return (
      <div className="plot-empty">
        <span>01</span>
        <p>Your first reading will draw the beginning of an environmental fingerprint here.</p>
      </div>
    );
  }

  return (
    <div className="plot" aria-label="Evidence sample comparison">
      <div className="plot-axis"><span>100</span><span>50</span><span>0</span></div>
      <div className="plot-bars">
        {samples.map((sample, index) => {
          const score = habitatScore(sample);
          return (
            <div className="plot-column" key={sample.id} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
              <div className="plot-track" style={{ "--bar": `${score}%` } as React.CSSProperties}>
                <span className="plot-value">{score}</span>
                <div className={`plot-bar ${sample.phase === "intervention" ? "is-after" : ""}`} />
              </div>
              <span className="plot-label">{sample.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const state = useSyncExternalStore(sensoriumStore.subscribe, sensoriumStore.getSnapshot);
  const [webMcpReady, setWebMcpReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [bridge, setBridge] = useState<AgentBridge | null>(null);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [bridgeError, setBridgeError] = useState("");
  const [bridgeCopied, setBridgeCopied] = useState(false);
  const [stationLabel, setStationLabel] = useState("Field station 01");
  const [expeditionCode, setExpeditionCode] = useState("");
  const [lastRemoteMission, setLastRemoteMission] = useState("");
  const appliedBridgeEvents = useRef(new Set<string>());
  const comparison = useMemo(() => compareSamples(state.samples), [state.samples]);

  useEffect(() => {
    registerSensoriumTools().then(setWebMcpReady).catch(() => setWebMcpReady(false));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!bridge) return;
    const timeout = window.setTimeout(() => {
      syncAgentBridge(bridge, state).catch(() => setBridgeError("Evidence sync paused. Reopen the bridge if it expired."));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [bridge, state]);

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    let cursor = new Date().toISOString();
    let timeout = 0;

    const poll = async () => {
      try {
        const { events } = await readAgentBridgeEvents(bridge, cursor);
        if (!active) return;
        for (const event of events) {
          if (appliedBridgeEvents.current.has(event.id)) continue;
          appliedBridgeEvents.current.add(event.id);
          cursor = event.at;
          if (event.type === "observation_request") {
            setLastRemoteMission(event.text);
            sensoriumStore.requestObservation(event.text);
          } else if (event.type === "intervention") {
            if (event.rationale) sensoriumStore.annotate(`Remote rationale: ${event.rationale}`);
            sensoriumStore.proposeIntervention(event.text);
          } else {
            sensoriumStore.annotate(event.text);
          }
        }
        setBridgeError("");
      } catch {
        if (active) setBridgeError("The bridge is unavailable or has expired.");
      }
      if (active) timeout = window.setTimeout(poll, 2500);
    };

    timeout = window.setTimeout(poll, 1000);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [bridge]);

  async function capturePhysical() {
    setCapturing(true);
    setCaptureError("");
    try {
      const reading = await capturePhysicalReading(
        state.intervention ? "Verification reading" : `Observation ${state.samples.length + 1}`,
        state.intervention ? "intervention" : "baseline",
      );
      sensoriumStore.addSample(reading);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "The reading could not be captured.");
    } finally {
      setCapturing(false);
    }
  }

  function downloadCapsule() {
    const capsule = JSON.stringify({ format: "sensorium-evidence-v1", exportedAt: new Date().toISOString(), ...state }, null, 2);
    const url = URL.createObjectURL(new Blob([capsule], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sensorium-${state.investigation.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function openBridge() {
    setBridgeBusy(true);
    setBridgeError("");
    setLastRemoteMission("");
    try {
      appliedBridgeEvents.current.clear();
      setBridge(await createAgentBridge(state, {
        stationLabel: stationLabel.trim() || "Field station 01",
        expeditionCode: expeditionCode.trim() || undefined,
      }));
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : "The agent bridge could not be opened.");
    } finally {
      setBridgeBusy(false);
    }
  }

  async function copyBridge() {
    if (!bridge) return;
    try {
      await navigator.clipboard.writeText(bridgeConnectionBrief(bridge));
      setBridgeCopied(true);
      window.setTimeout(() => setBridgeCopied(false), 1800);
    } catch {
      setBridgeError("Clipboard access was unavailable. Copy the endpoint and code manually.");
    }
  }

  async function closeBridge() {
    if (!bridge) return;
    const current = bridge;
    setBridge(null);
    setBridgeError("");
    setLastRemoteMission("");
    await closeAgentBridge(current).catch(() => undefined);
  }

  return (
    <main className="shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Sensorium home">
          <span className="wordmark-mark" aria-hidden="true"><i /><i /></span>
          Sensorium
        </a>
        <div className="station-meta">
          <span>{bridge?.stationLabel ?? (stationLabel.trim() || "Field station 01")}</span>
          <span className={webMcpReady ? "status-live" : "status-preview"}>
            {webMcpReady ? "WebMCP live" : "Browser preview"}
          </span>
        </div>
        <button className="text-button" onClick={downloadCapsule}>Export evidence ↗</button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Human × agent field laboratory</p>
          <h1>Give your agent<br />a way to <em>sense.</em></h1>
          <p className="lede">You move through the world. Your agent structures the inquiry. Sensorium turns browser signals into evidence you can inspect together.</p>
        </div>
        <aside className="field-note">
          <span>Working question</span>
          <blockquote>“{state.investigation.question}”</blockquote>
          <small>Opened {formatTime(state.investigation.createdAt)} · local to this browser</small>
        </aside>
      </section>

      <section className="workspace" aria-label="Active investigation workspace">
        <div className="mission-panel">
          <div className="section-heading">
            <div><span className="section-number">01</span><p>Current mission</p></div>
            <span className="phase-label">{state.samples.length ? `${state.samples.length} signals` : "baseline"}</span>
          </div>

          <div className="mission-body">
            <div className="mission-copy">
              <p className="mission-prompt">{state.requestedObservation}</p>
              {state.intervention && <p className="intervention"><span>Test</span>{state.intervention}</p>}
              <div className="actions">
                <button className="primary-action" onClick={capturePhysical} disabled={capturing}>
                  <span className="pulse-dot" />
                  {capturing ? "Listening & looking…" : "Capture physical reading"}
                </button>
                <button className="secondary-action" onClick={() => sensoriumStore.addSimulatedSample(`Sample ${state.samples.length + 1}`, state.intervention ? "intervention" : "baseline")}>Simulate</button>
              </div>
              {captureError && <p className="capture-error" role="alert">{captureError}</p>}
              <p className="permission-note">Camera and microphone stay on-device and only activate after you press capture.</p>
            </div>
            <Instrument samples={state.samples} />
          </div>
        </div>

        <aside className="agent-panel">
          <div className="section-heading inverse">
            <div><span className="section-number">02</span><p>Agent channel</p></div>
            <span className="phase-label">11 web · 12 remote</span>
          </div>
          <p className="agent-statement">The agent cannot move through your room. You cannot compare every signal at once. Together, you can.</p>
          <div className="tool-strip" aria-label="Agent tools">
            <span>inspect</span><span>request</span><span>capture</span><span>compare</span><span>verify</span>
          </div>
          <div className="agent-callout">
            <span className="agent-glyph">✳</span>
            <p>{comparison.ready ? `Strongest signal: ${comparison.best?.label} at ${comparison.best?.score}/100.` : "Ask your browser agent to design the next observation."}</p>
          </div>
          <div className={`bridge-panel ${bridge ? "is-open" : ""}`}>
            <div className="bridge-heading">
              <span className="bridge-signal" />
              <p>Remote MCP bridge</p>
              <small>{bridge ? "live · 1 hour" : "off"}</small>
            </div>
            {bridge ? (
              <div className="bridge-open">
                <p>Structured evidence is available to an MCP client. Raw media never leaves this page.</p>
                <div className="bridge-identity">
                  <span>{bridge.stationLabel}</span>
                  {bridge.expedition && <span>{bridge.expedition.title} · {bridge.expedition.profile.replace("_", " ")}</span>}
                </div>
                <div className="bridge-code"><span>{bridge.expeditionCode ? "Station bridge code" : "Bridge code"}</span><strong>{bridge.code}</strong></div>
                {bridge.expeditionCode && <div className="expedition-code"><span>Expedition</span><strong>{bridge.expeditionCode}</strong></div>}
                <code>{bridge.mcpUrl}</code>
                {lastRemoteMission && <p className="bridge-mission"><span>Incoming mission</span>{lastRemoteMission}</p>}
                <div className="bridge-actions">
                  <button onClick={copyBridge}>{bridgeCopied ? "Copied connection brief" : "Copy connection brief"}</button>
                  <button onClick={closeBridge}>Close</button>
                </div>
              </div>
            ) : (
              <div className="bridge-closed">
                <p>Open a temporary path for Codex, Claude, or another MCP client to read this evidence and send findings back.</p>
                <label className="bridge-field">
                  <span>Station name</span>
                  <input value={stationLabel} onChange={(event) => setStationLabel(event.target.value)} maxLength={80} />
                </label>
                <details className="expedition-join">
                  <summary>Join a multi-station expedition</summary>
                  <label className="bridge-field">
                    <span>Expedition code</span>
                    <input
                      value={expeditionCode}
                      onChange={(event) => setExpeditionCode(event.target.value.trim())}
                      placeholder="Code from the field director"
                      maxLength={24}
                    />
                  </label>
                  <small>Leave blank for an independent bridge.</small>
                </details>
                <button onClick={openBridge} disabled={bridgeBusy}>{bridgeBusy ? "Opening bridge…" : "Open agent bridge ↗"}</button>
              </div>
            )}
            {bridgeError && <p className="bridge-error" role="alert">{bridgeError}</p>}
          </div>
        </aside>
      </section>

      <section className="evidence-section">
        <div className="evidence-intro">
          <div className="section-heading">
            <div><span className="section-number">03</span><p>Evidence field</p></div>
          </div>
          <h2>Signals become a story<br />only when we compare them.</h2>
          <div className="evidence-controls">
            <button className="text-button" onClick={() => sensoriumStore.loadDemonstration()}>Load demonstration</button>
            <button className="text-button muted" onClick={() => sensoriumStore.reset()}>Clear field</button>
          </div>
        </div>
        <EvidencePlot samples={state.samples} />
      </section>

      <section className="ledger-section">
        <div className="ledger-title">
          <p className="eyebrow">Shared activity ledger</p>
          <h2>Nothing happens<br />out of sight.</h2>
        </div>
        <ol className="ledger">
          {state.activity.slice(-5).reverse().map((item) => (
            <li key={item.id}>
              <time>{formatTime(item.at)}</time>
              <span className={`actor actor-${item.actor}`}>{item.actor}</span>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer>
        <span>Sensorium / field build 0.3</span>
        <p>The mind is distributed. The evidence is shared.</p>
        <span>Local-first · WebMCP + MCP</span>
      </footer>
    </main>
  );
}
