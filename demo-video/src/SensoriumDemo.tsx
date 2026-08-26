import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";

const paper = "#f3efe3";
const paperDeep = "#dfd7c4";
const ink = "#173423";
const forest = "#173f28";
const signal = "#c95b39";
const soft = "#59685e";
const serif = '"Iowan Old Style", Baskerville, Georgia, serif';
const sans = '"Avenir Next", Avenir, "Century Gothic", sans-serif';

const sceneFrames = [300, 480, 690, 600, 570, 690, 450, 600];
const sceneStarts = sceneFrames.map((_, index) => sceneFrames.slice(0, index).reduce((sum, value) => sum + value, 0));

const fade = (frame: number, duration: number, fps: number) => {
  const intro = interpolate(frame, [0, 0.55 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.exp) });
  const outro = interpolate(frame, [duration - 0.45 * fps, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return Math.min(intro, outro);
};

const Frame = ({ index, children, dark = false }: { index: number; children: ReactNode; dark?: boolean }) => (
  <AbsoluteFill style={{ background: dark ? forest : paper, color: dark ? paper : ink, fontFamily: sans, padding: "58px 72px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 20, borderBottom: `1px solid ${dark ? "#66806d" : "#b8b09d"}`, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: 18 }}>
      <span>Sensorium / WebMCP field laboratory</span>
      <span style={{ color: signal }}>0{index}</span>
    </div>
    {children}
  </AbsoluteFill>
);

const Reveal = ({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 0.75 * fps });
  return <div style={{ opacity: entrance, transform: `translateY(${(1 - entrance) * 34}px)`, ...style }}>{children}</div>;
};

const BrowserShot = ({ file, position = "center", zoom = 1 }: { file: string; position?: string; zoom?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = interpolate(frame, [0, 12 * fps], [1, 1.025 * zoom], { extrapolateRight: "clamp" });
  return (
    <div style={{ border: "1px solid #a9a18f", background: paperDeep, boxShadow: "0 25px 70px rgba(23,52,35,.16)", overflow: "hidden", height: "100%" }}>
      <div style={{ height: 42, borderBottom: "1px solid #b8b09d", display: "flex", alignItems: "center", gap: 9, padding: "0 16px" }}>
        {[signal, "#d4aa58", "#61876b"].map((color) => <i key={color} style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />)}
        <span style={{ marginLeft: 16, color: soft, fontSize: 14 }}>sensorium-devsnorte.fly.dev</span>
      </div>
      <Img src={staticFile(file)} style={{ width: "100%", height: "calc(100% - 42px)", objectFit: "cover", objectPosition: position, transform: `scale(${drift})` }} />
    </div>
  );
};

const Kicker = ({ children }: { children: ReactNode }) => <p style={{ margin: 0, color: signal, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: 20, fontWeight: 700 }}>{children}</p>;
const Title = ({ children, light = false }: { children: ReactNode; light?: boolean }) => <h2 style={{ margin: "24px 0", maxWidth: 1100, fontFamily: serif, fontWeight: 500, fontSize: 86, lineHeight: .95, letterSpacing: "-.045em", color: light ? paper : ink }}>{children}</h2>;
const Body = ({ children, light = false }: { children: ReactNode; light?: boolean }) => <p style={{ margin: 0, maxWidth: 940, fontSize: 30, lineHeight: 1.45, color: light ? "#d7dfd3" : soft }}>{children}</p>;

const Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Frame index={1}>
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 72, alignItems: "center", flex: 1, height: "calc(100% - 50px)" }}>
        <div style={{ opacity: fade(frame, sceneFrames[0], fps) }}>
          <Reveal><Kicker>Human × agent fieldwork</Kicker></Reveal>
          <Reveal delay={10}><h1 style={{ margin: "32px 0", fontFamily: serif, fontSize: 132, fontWeight: 500, lineHeight: .82, letterSpacing: "-.065em" }}>Give your agent<br />a way to <em style={{ color: signal, fontWeight: 400 }}>sense.</em></h1></Reveal>
          <Reveal delay={20}><Body>AI can reason about a room. It cannot stand inside one.</Body></Reveal>
        </div>
        <Reveal delay={12} style={{ height: 720 }}><BrowserShot file="sensorium-hero.png" position="top center" /></Reveal>
      </div>
    </Frame>
  );
};

const Division = () => (
  <Frame index={2} dark>
    <div style={{ paddingTop: 72 }}>
      <Reveal><Kicker>Asymmetric collaboration</Kicker><Title light>The agent has the mind.<br />People have the bodies.</Title></Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, marginTop: 58 }}>
        <Reveal delay={14} style={{ borderTop: "2px solid #d7dfd3", paddingTop: 30 }}>
          <p style={{ fontFamily: serif, fontSize: 54, margin: 0 }}>Human station</p>
          <Body light>Physical presence · context · permission · judgment</Body>
        </Reveal>
        <Reveal delay={26} style={{ borderTop: `2px solid ${signal}`, paddingTop: 30 }}>
          <p style={{ fontFamily: serif, fontSize: 54, margin: 0 }}>Agent director</p>
          <Body light>Protocol · coordination · comparison · interpretation</Body>
        </Reveal>
      </div>
      <Reveal delay={40} style={{ marginTop: 70, display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: signal }} />
        <p style={{ fontSize: 30, margin: 0 }}>WebMCP is the structured nervous system between them.</p>
      </Reveal>
    </div>
  </Frame>
);

const Expedition = () => (
  <Frame index={3}>
    <div style={{ display: "grid", gridTemplateColumns: ".72fr 1.28fr", gap: 64, height: "calc(100% - 55px)", alignItems: "center" }}>
      <Reveal>
        <Kicker>Field Desk Atlas</Kicker>
        <Title>One mission.<br />Many places.</Title>
        <Body>An MCP agent creates a six-hour expedition and broadcasts the same observation protocol to independent browser stations.</Body>
        <div style={{ marginTop: 44, display: "grid", gap: 14, fontSize: 24 }}>
          <span>● Quartinho — Belém</span>
          <span>● Library window — São Paulo</span>
        </div>
      </Reveal>
      <Reveal delay={18} style={{ height: 760 }}><BrowserShot file="sensorium-expedition.png" position="center" /></Reveal>
    </div>
  </Frame>
);

const Protocol = () => (
  <Frame index={4}>
    <div style={{ display: "grid", gridTemplateColumns: "1.18fr .82fr", gap: 66, height: "calc(100% - 55px)", alignItems: "center" }}>
      <Reveal style={{ height: 760 }}><BrowserShot file="sensorium-protocol.png" position="center" /></Reveal>
      <Reveal delay={18}>
        <Kicker>Human-authorized capture</Kicker>
        <Title>Eight seconds.<br />Thirty-two readings.</Title>
        <Body>The browser pairs relative sound and camera luminance, keeps the screen awake, checks motion, and stores only derived evidence.</Body>
        <div style={{ marginTop: 42, paddingTop: 26, borderTop: "1px solid #b8b09d", display: "grid", gap: 12, fontSize: 23 }}>
          <span>✓ Sensor access requires a person</span>
          <span>✓ Raw audio and video are discarded</span>
          <span>✓ Medians reduce one-frame noise</span>
        </div>
      </Reveal>
    </div>
  </Frame>
);

const Quality = () => (
  <Frame index={5} dark>
    <div style={{ paddingTop: 70 }}>
      <Reveal><Kicker>Suitability ≠ trust</Kicker><Title light>Agents can challenge<br />weak evidence.</Title></Reveal>
      <div style={{ display: "grid", gridTemplateColumns: ".7fr 1.3fr", gap: 70, alignItems: "end", marginTop: 48 }}>
        <Reveal delay={14}>
          <div style={{ borderTop: "1px solid #6f8975", paddingTop: 22 }}>
            <span style={{ textTransform: "uppercase", letterSpacing: ".18em", fontSize: 17 }}>Quartinho physical reading</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 12 }}><strong style={{ fontFamily: serif, fontSize: 128, fontWeight: 400 }}>86%</strong><span style={{ fontSize: 25 }}>confidence</span></div>
            <p style={{ color: "#d7dfd3", fontSize: 25, lineHeight: 1.45 }}>8.15 seconds · 32 readings<br />Sound varied · motion estimated</p>
          </div>
        </Reveal>
        <Reveal delay={24}>
          <div style={{ border: "1px solid #6f8975", padding: 40 }}>
            <p style={{ color: signal, textTransform: "uppercase", letterSpacing: ".18em", fontSize: 18 }}>request_bridge_recapture</p>
            <p style={{ fontFamily: serif, fontSize: 42, lineHeight: 1.18, margin: "24px 0" }}>“Repeat the observation with the phone resting in the same position.”</p>
            <Body light>The agent may request. Only the person can start the camera and microphone.</Body>
          </div>
        </Reveal>
      </div>
    </div>
  </Frame>
);

const Comparison = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: frame - 20, fps, config: { damping: 200 }, durationInFrames: 1.1 * fps });
  const stations = [
    { label: "Library window — São Paulo", score: 93, confidence: 96, source: "deterministic simulation", color: forest },
    { label: "Quartinho — Belém", score: 67, confidence: 86, source: "physical browser capture", color: signal },
  ];
  return (
    <Frame index={6}>
      <Reveal><Kicker>Goal-specific comparison</Kicker><Title>Where should I focus?</Title></Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 54, marginTop: 40 }}>
        {stations.map((station, index) => (
          <div key={station.label} style={{ borderTop: `2px solid ${station.color}`, paddingTop: 28 }}>
            <div style={{ height: 280, display: "flex", alignItems: "end", gap: 28 }}>
              <div style={{ width: 150, height: `${station.score * 2.7 * grow}px`, maxHeight: 270, background: station.color }} />
              <div style={{ paddingBottom: 8 }}><strong style={{ fontFamily: serif, fontSize: 110, fontWeight: 400 }}>{station.score}</strong><span style={{ fontSize: 24 }}>/100 focus</span></div>
            </div>
            <p style={{ fontFamily: serif, fontSize: 38, margin: "22px 0 8px" }}>{station.label}</p>
            <p style={{ color: soft, fontSize: 22, margin: 0 }}>{station.confidence}% evidence confidence · {station.source}</p>
            {index === 0 && <p style={{ marginTop: 18, color: signal, textTransform: "uppercase", letterSpacing: ".16em", fontWeight: 700 }}>Best current station</p>}
          </div>
        ))}
      </div>
    </Frame>
  );
};

const Ledger = () => (
  <Frame index={7}>
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 70, height: "calc(100% - 55px)", alignItems: "center" }}>
      <Reveal style={{ height: 740 }}><BrowserShot file="sensorium-ledger.png" position="center" /></Reveal>
      <Reveal delay={18}>
        <Kicker>Nothing happens out of sight</Kicker>
        <Title>Visible actions.<br />Expiring access.</Title>
        <Body>Every human action and agent side effect returns to the shared ledger. Bridges expire after one hour; expeditions after six.</Body>
        <div style={{ marginTop: 38, display: "grid", gap: 14, fontSize: 24 }}>
          <span>Raw media: never uploaded</span>
          <span>Precise location: not collected</span>
          <span>Sound and light: explicitly relative</span>
        </div>
      </Reveal>
    </div>
  </Frame>
);

const Outro = () => (
  <Frame index={8} dark>
    <div style={{ display: "grid", placeContent: "center", textAlign: "center", height: "calc(100% - 55px)" }}>
      <Reveal><Kicker>13 WebMCP tools · 14 remote MCP tools</Kicker></Reveal>
      <Reveal delay={12}><h2 style={{ fontFamily: serif, fontSize: 112, lineHeight: .9, fontWeight: 500, letterSpacing: "-.055em", margin: "36px 0" }}>The mind is distributed.<br /><em style={{ color: signal, fontWeight: 400 }}>The evidence is shared.</em></h2></Reveal>
      <Reveal delay={24}><p style={{ fontSize: 28, margin: "10px 0" }}>sensorium-devsnorte.fly.dev</p><p style={{ color: "#b8c7ba", fontSize: 22 }}>github.com/iagocavalcante/sensorium</p></Reveal>
    </div>
  </Frame>
);

const scenes = [Intro, Division, Expedition, Protocol, Quality, Comparison, Ledger, Outro];

export const SensoriumDemo = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: paper }}>
      <Audio src={staticFile("narration.m4a")} volume={1} />
      {scenes.map((Scene, index) => (
        <Sequence key={index} from={sceneStarts[index]} durationInFrames={sceneFrames[index]} premountFor={fps}>
          <Scene />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const SensoriumThumbnail = () => (
  <AbsoluteFill style={{ background: paper, color: ink, fontFamily: sans, padding: 68 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr .9fr", gap: 48, height: "100%", alignItems: "center" }}>
      <div>
        <Kicker>WebMCP field laboratory</Kicker>
        <h1 style={{ fontFamily: serif, fontSize: 102, fontWeight: 500, lineHeight: .84, letterSpacing: "-.06em", margin: "34px 0" }}>Give your agent<br />a way to <em style={{ color: signal, fontWeight: 400 }}>sense.</em></h1>
        <p style={{ color: soft, fontSize: 25 }}>People + agents become a distributed instrument.</p>
      </div>
      <div style={{ height: 540 }}><BrowserShot file="sensorium-expedition.png" position="center" /></div>
    </div>
  </AbsoluteFill>
);
