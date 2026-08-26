import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  const comparison = useMemo(() => compareSamples(state.samples), [state.samples]);

  useEffect(() => {
    registerSensoriumTools().then(setWebMcpReady).catch(() => setWebMcpReady(false));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

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

  return (
    <main className="shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Sensorium home">
          <span className="wordmark-mark" aria-hidden="true"><i /><i /></span>
          Sensorium
        </a>
        <div className="station-meta">
          <span>Field station 01</span>
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
            <span className="phase-label">9 tools</span>
          </div>
          <p className="agent-statement">The agent cannot move through your room. You cannot compare every signal at once. Together, you can.</p>
          <div className="tool-strip" aria-label="Agent tools">
            <span>inspect</span><span>request</span><span>capture</span><span>compare</span><span>verify</span>
          </div>
          <div className="agent-callout">
            <span className="agent-glyph">✳</span>
            <p>{comparison.ready ? `Strongest signal: ${comparison.best?.label} at ${comparison.best?.score}/100.` : "Ask your browser agent to design the next observation."}</p>
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
        <span>Sensorium / field build 0.1</span>
        <p>The mind is distributed. The evidence is shared.</p>
        <span>Local-first · WebMCP</span>
      </footer>
    </main>
  );
}
