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

export const goalProfiles = {
  focus: {
    title: "Focused work",
    description: "Balances quiet, useful task lighting, and a stable setup.",
    targetBrightness: 70,
    weights: { noise: 0.4, light: 0.35, steadiness: 0.25 },
  },
  sleep: {
    title: "Restful sleep",
    description: "Strongly rewards quiet and darkness, with a stable environment.",
    targetBrightness: 5,
    weights: { noise: 0.5, light: 0.3, steadiness: 0.2 },
  },
  reading: {
    title: "Comfortable reading",
    description: "Prioritizes generous, even light without ignoring noise.",
    targetBrightness: 82,
    weights: { noise: 0.25, light: 0.5, steadiness: 0.25 },
  },
  video_call: {
    title: "Video calls",
    description: "Rewards flattering light, a quiet room, and a stable camera position.",
    targetBrightness: 76,
    weights: { noise: 0.32, light: 0.4, steadiness: 0.28 },
  },
  recording: {
    title: "Audio recording",
    description: "Prioritizes the quietest available environment.",
    targetBrightness: 50,
    weights: { noise: 0.7, light: 0.05, steadiness: 0.25 },
  },
} as const;

export type GoalProfile = keyof typeof goalProfiles;

export function scoreEnvironmentSample(
  sample: Pick<EnvironmentSample, "soundDb" | "brightness" | "steadiness">,
  profile: GoalProfile = "focus",
) {
  const goal = goalProfiles[profile];
  const noiseScore = Math.max(0, Math.min(100, ((75 - sample.soundDb) / 40) * 100));
  const lightScore = Math.max(0, 100 - Math.abs(sample.brightness - goal.targetBrightness) * 1.5);
  return Math.round(
    noiseScore * goal.weights.noise
    + lightScore * goal.weights.light
    + sample.steadiness * goal.weights.steadiness,
  );
}

export function habitatScore(sample: Pick<EnvironmentSample, "soundDb" | "brightness" | "steadiness">) {
  return scoreEnvironmentSample(sample, "focus");
}

export function compareEnvironmentSamples(samples: EnvironmentSample[], profile: GoalProfile = "focus") {
  if (samples.length < 2) {
    return { ready: false as const, message: "Capture at least two samples to compare them." };
  }

  const ranked = samples
    .map((sample) => ({
      id: sample.id,
      label: sample.label,
      phase: sample.phase,
      score: scoreEnvironmentSample(sample, profile),
      soundDb: sample.soundDb,
      brightness: sample.brightness,
      steadiness: sample.steadiness,
    }))
    .sort((a, b) => b.score - a.score);

  return { ready: true as const, profile, goal: goalProfiles[profile], best: ranked[0], ranked };
}
