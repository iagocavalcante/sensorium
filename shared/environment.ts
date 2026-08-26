export type SamplePhase = "baseline" | "intervention";

export type EnvironmentSample = {
  id: string;
  label: string;
  capturedAt: string;
  soundDb: number;
  brightness: number;
  steadiness: number;
  phase: SamplePhase;
  source: "simulated" | "physical";
};

export type EnvironmentActivity = {
  id: string;
  at: string;
  actor: "human" | "agent" | "instrument";
  text: string;
};

export type EnvironmentInvestigation = {
  id: string;
  title: string;
  question: string;
  status: "active" | "complete";
  createdAt: string;
};

export type EnvironmentSnapshot = {
  investigation: EnvironmentInvestigation;
  requestedObservation: string;
  intervention: string;
  samples: EnvironmentSample[];
  activity: EnvironmentActivity[];
};

export function habitatScore(sample: Pick<EnvironmentSample, "soundDb" | "brightness" | "steadiness">) {
  const noiseScore = Math.max(0, Math.min(100, ((75 - sample.soundDb) / 40) * 100));
  const lightScore = Math.max(0, 100 - Math.abs(sample.brightness - 70) * 1.5);
  return Math.round(noiseScore * 0.4 + lightScore * 0.35 + sample.steadiness * 0.25);
}

export function compareEnvironmentSamples(samples: EnvironmentSample[]) {
  if (samples.length < 2) {
    return { ready: false as const, message: "Capture at least two samples to compare them." };
  }

  const ranked = samples
    .map((sample) => ({
      id: sample.id,
      label: sample.label,
      phase: sample.phase,
      score: habitatScore(sample),
      soundDb: sample.soundDb,
      brightness: sample.brightness,
      steadiness: sample.steadiness,
    }))
    .sort((a, b) => b.score - a.score);

  return { ready: true as const, best: ranked[0], ranked };
}
