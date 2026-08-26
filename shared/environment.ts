export type SamplePhase = "baseline" | "intervention";

export type EvidenceQualityGrade = "high" | "usable" | "low";

export type EvidenceQuality = {
  confidence: number;
  grade: EvidenceQualityGrade;
  durationMs: number;
  readingCount: number;
  soundSpread: number;
  lightSpread: number;
  motionAvailable: boolean;
  issues: string[];
  recaptureRecommended: boolean;
};

export type EnvironmentSample = {
  id: string;
  label: string;
  capturedAt: string;
  soundDb: number;
  brightness: number;
  steadiness: number;
  phase: SamplePhase;
  source: "simulated" | "physical";
  quality?: EvidenceQuality;
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

export function assessEvidenceQuality(input: {
  source: EnvironmentSample["source"];
  durationMs: number;
  readingCount: number;
  soundSpread: number;
  lightSpread: number;
  steadiness: number;
  motionAvailable: boolean;
}): EvidenceQuality {
  if (input.source === "simulated") {
    return {
      confidence: 96,
      grade: "high",
      durationMs: input.durationMs,
      readingCount: input.readingCount,
      soundSpread: input.soundSpread,
      lightSpread: input.lightSpread,
      motionAvailable: true,
      issues: ["Synthetic demonstration data; not a physical observation."],
      recaptureRecommended: false,
    };
  }

  let confidence = 100;
  const issues: string[] = [];
  if (input.durationMs < 7_000) {
    confidence -= 18;
    issues.push("Observation was shorter than the eight-second field protocol.");
  }
  if (input.readingCount < 20) {
    confidence -= 15;
    issues.push("Too few readings were available for a stable median.");
  }
  if (input.soundSpread > 20) {
    confidence -= 14;
    issues.push("Relative sound changed substantially during capture.");
  } else if (input.soundSpread > 10) {
    confidence -= 6;
    issues.push("Relative sound varied during capture.");
  }
  if (input.lightSpread > 25) {
    confidence -= 14;
    issues.push("Lighting changed substantially during capture.");
  } else if (input.lightSpread > 12) {
    confidence -= 6;
    issues.push("Lighting varied during capture.");
  }
  if (input.steadiness < 60) {
    confidence -= 25;
    issues.push("The device moved too much for a comparable reading.");
  } else if (input.steadiness < 78) {
    confidence -= 12;
    issues.push("Some device movement may reduce comparability.");
  }
  if (!input.motionAvailable) {
    confidence -= 8;
    issues.push("Device-motion validation was unavailable; steadiness was estimated.");
  }

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));
  const grade: EvidenceQualityGrade = confidence >= 85 ? "high" : confidence >= 65 ? "usable" : "low";
  return {
    confidence,
    grade,
    durationMs: input.durationMs,
    readingCount: input.readingCount,
    soundSpread: Math.round(input.soundSpread),
    lightSpread: Math.round(input.lightSpread),
    motionAvailable: input.motionAvailable,
    issues,
    recaptureRecommended: confidence < 65,
  };
}

export function sampleEvidenceQuality(sample: EnvironmentSample): EvidenceQuality {
  if (sample.quality) return sample.quality;
  if (sample.source === "simulated") {
    return assessEvidenceQuality({
      source: "simulated",
      durationMs: 8_000,
      readingCount: 32,
      soundSpread: 2,
      lightSpread: 2,
      steadiness: sample.steadiness,
      motionAvailable: true,
    });
  }
  return {
    confidence: 60,
    grade: "low",
    durationMs: 0,
    readingCount: 1,
    soundSpread: 0,
    lightSpread: 0,
    motionAvailable: false,
    issues: ["Legacy single-point reading; recapture with the timed protocol for stronger evidence."],
    recaptureRecommended: true,
  };
}

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
    .map((sample) => {
      const quality = sampleEvidenceQuality(sample);
      return {
        id: sample.id,
        label: sample.label,
        phase: sample.phase,
        score: scoreEnvironmentSample(sample, profile),
        soundDb: sample.soundDb,
        brightness: sample.brightness,
        steadiness: sample.steadiness,
        confidence: quality.confidence,
        qualityGrade: quality.grade,
        recaptureRecommended: quality.recaptureRecommended,
      };
    })
    .sort((a, b) => b.score - a.score);

  const needsRecapture = ranked.filter((sample) => sample.recaptureRecommended);
  return {
    ready: true as const,
    decisionReady: needsRecapture.length === 0,
    caution: needsRecapture.length ? `${needsRecapture.length} sample${needsRecapture.length === 1 ? " needs" : "s need"} recapture before a confident decision.` : undefined,
    profile,
    goal: goalProfiles[profile],
    best: ranked[0],
    ranked,
  };
}
