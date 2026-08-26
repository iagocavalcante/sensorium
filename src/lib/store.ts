export type SamplePhase = "baseline" | "intervention";

export type Sample = {
  id: string;
  label: string;
  capturedAt: string;
  soundDb: number;
  brightness: number;
  steadiness: number;
  phase: SamplePhase;
  source: "simulated" | "physical";
};

export type Activity = {
  id: string;
  at: string;
  actor: "human" | "agent" | "instrument";
  text: string;
};

export type Investigation = {
  id: string;
  title: string;
  question: string;
  status: "active" | "complete";
  createdAt: string;
};

export type SensoriumState = {
  investigation: Investigation;
  requestedObservation: string;
  intervention: string;
  samples: Sample[];
  activity: Activity[];
};

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const initialState: SensoriumState = {
  investigation: {
    id: "investigation-focus",
    title: "Focus habitat",
    question: "Where in this room can I do my best focused work?",
    status: "active",
    createdAt: new Date().toISOString(),
  },
  requestedObservation: "Take one quiet baseline reading at your desk.",
  intervention: "",
  samples: [],
  activity: [
    {
      id: "activity-welcome",
      at: new Date().toISOString(),
      actor: "instrument",
      text: "Field station ready. Waiting for the first observation.",
    },
  ],
};

const stored = localStorage.getItem("sensorium-state-v1");
let state: SensoriumState = stored ? (JSON.parse(stored) as SensoriumState) : initialState;
const listeners = new Set<() => void>();

function publish(next: SensoriumState) {
  state = next;
  localStorage.setItem("sensorium-state-v1", JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

function activity(actor: Activity["actor"], text: string): Activity {
  return { id: makeId("activity"), at: new Date().toISOString(), actor, text };
}

export const sensoriumStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  startInvestigation(title: string, question: string) {
    publish({
      ...initialState,
      investigation: {
        id: makeId("investigation"),
        title,
        question,
        status: "active",
        createdAt: new Date().toISOString(),
      },
      requestedObservation: "Choose a place and capture a baseline reading.",
      activity: [activity("agent", `Opened investigation: ${title}.`)],
    });
    return state.investigation;
  },
  requestObservation(prompt: string) {
    publish({
      ...state,
      requestedObservation: prompt,
      activity: [...state.activity, activity("agent", `Requested: ${prompt}`)],
    });
  },
  addSample(sample: Omit<Sample, "id" | "capturedAt">) {
    const complete: Sample = {
      ...sample,
      id: makeId("sample"),
      capturedAt: new Date().toISOString(),
    };
    publish({
      ...state,
      samples: [...state.samples, complete],
      activity: [
        ...state.activity,
        activity("human", `Captured ${sample.label}: ${sample.soundDb} dB, ${sample.brightness}% light.`),
      ],
    });
    return complete;
  },
  addSimulatedSample(label: string, phase: SamplePhase = "baseline") {
    const index = state.samples.length;
    const baseline = [
      { soundDb: 58, brightness: 34, steadiness: 71 },
      { soundDb: 42, brightness: 78, steadiness: 86 },
      { soundDb: 51, brightness: 56, steadiness: 79 },
    ][index % 3];
    const adjusted = phase === "intervention"
      ? { soundDb: 39, brightness: 72, steadiness: 91 }
      : baseline;
    return this.addSample({ label, phase, source: "simulated", ...adjusted });
  },
  annotate(text: string) {
    publish({ ...state, activity: [...state.activity, activity("agent", text)] });
  },
  proposeIntervention(text: string) {
    publish({
      ...state,
      intervention: text,
      requestedObservation: "Apply the intervention, then capture a verification reading.",
      activity: [...state.activity, activity("agent", `Proposed intervention: ${text}`)],
    });
  },
  loadDemonstration() {
    const now = new Date().toISOString();
    publish({
      ...initialState,
      requestedObservation: "Move the lamp closer, then capture a verification reading.",
      intervention: "Move the task lamp closer and close the window during the focus block.",
      samples: [
        { id: "sample-desk", label: "Desk", capturedAt: now, soundDb: 58, brightness: 34, steadiness: 71, phase: "baseline", source: "simulated" },
        { id: "sample-window", label: "Window", capturedAt: now, soundDb: 42, brightness: 78, steadiness: 86, phase: "baseline", source: "simulated" },
        { id: "sample-after", label: "Desk after change", capturedAt: now, soundDb: 39, brightness: 72, steadiness: 91, phase: "intervention", source: "simulated" },
      ],
      activity: [
        activity("human", "Captured baseline readings at the desk and window."),
        activity("agent", "The window is 16 dB quieter and has more than twice the usable light."),
        activity("agent", "Proposed a lamp and window intervention for the desk."),
        activity("instrument", "Verification improved the habitat score from 51 to 93."),
      ],
    });
  },
  reset() {
    publish({
      ...initialState,
      investigation: { ...initialState.investigation, createdAt: new Date().toISOString() },
      activity: [{ ...initialState.activity[0], at: new Date().toISOString() }],
    });
  },
};

export function habitatScore(sample: Sample) {
  const noiseScore = Math.max(0, Math.min(100, ((75 - sample.soundDb) / 40) * 100));
  const lightScore = Math.max(0, 100 - Math.abs(sample.brightness - 70) * 1.5);
  return Math.round(noiseScore * 0.4 + lightScore * 0.35 + sample.steadiness * 0.25);
}

export function compareSamples(samples = state.samples) {
  if (samples.length < 2) {
    return { ready: false, message: "Capture at least two samples to compare them." };
  }
  const ranked = samples
    .map((sample) => ({ id: sample.id, label: sample.label, score: habitatScore(sample) }))
    .sort((a, b) => b.score - a.score);
  return { ready: true, best: ranked[0], ranked };
}
