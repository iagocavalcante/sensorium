import {
  assessEvidenceQuality,
  compareEnvironmentSamples,
  habitatScore,
  type EnvironmentActivity,
  type EnvironmentInvestigation,
  type EnvironmentSample,
  type EnvironmentSnapshot,
  type SamplePhase,
} from "../../shared/environment";

export type Sample = EnvironmentSample;
export type Activity = EnvironmentActivity;
export type Investigation = EnvironmentInvestigation;
export type SensoriumState = EnvironmentSnapshot;
export type { SamplePhase };

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const simulatedQuality = (steadiness: number) => assessEvidenceQuality({
  source: "simulated",
  durationMs: 8_000,
  readingCount: 32,
  soundSpread: 2,
  lightSpread: 2,
  steadiness,
  motionAvailable: true,
});

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
        activity("human", `Captured ${sample.label}: ${sample.soundDb}/100 relative sound, ${sample.brightness}% relative light${sample.quality ? `, ${sample.quality.confidence}% confidence` : ""}.`),
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
    return this.addSample({
      label,
      phase,
      source: "simulated",
      ...adjusted,
      quality: simulatedQuality(adjusted.steadiness),
    });
  },
  requestRecapture(sampleId?: string, reason?: string) {
    const sample = sampleId ? state.samples.find((candidate) => candidate.id === sampleId) : state.samples.at(-1);
    if (!sample) return undefined;
    const prompt = `Repeat “${sample.label}” with the phone resting in the same position for the full eight-second protocol.${reason ? ` ${reason}` : ""}`;
    publish({
      ...state,
      requestedObservation: prompt,
      activity: [...state.activity, activity("agent", `Requested recapture of ${sample.label}: ${reason || "improve evidence confidence"}.`)],
    });
    return { sampleId: sample.id, prompt };
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
        { id: "sample-desk", label: "Desk", capturedAt: now, soundDb: 58, brightness: 34, steadiness: 71, phase: "baseline", source: "simulated", quality: simulatedQuality(71) },
        { id: "sample-window", label: "Window", capturedAt: now, soundDb: 42, brightness: 78, steadiness: 86, phase: "baseline", source: "simulated", quality: simulatedQuality(86) },
        { id: "sample-after", label: "Desk after change", capturedAt: now, soundDb: 39, brightness: 72, steadiness: 91, phase: "intervention", source: "simulated", quality: simulatedQuality(91) },
      ],
      activity: [
        activity("human", "Captured baseline readings at the desk and window."),
        activity("agent", "The window is 16 relative-sound points quieter and has more than twice the usable light."),
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

export function compareSamples(samples = state.samples) {
  return compareEnvironmentSamples(samples);
}

export { habitatScore };
