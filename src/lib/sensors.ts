import {
  assessEvidenceQuality,
  type EvidenceQuality,
  type SamplePhase,
} from "../../shared/environment";

export type PhysicalReading = {
  label: string;
  soundDb: number;
  brightness: number;
  steadiness: number;
  phase: SamplePhase;
  source: "physical";
  quality: EvidenceQuality;
};

export type CaptureProgress = {
  stage: "permission" | "settling" | "sampling";
  progress: number;
  remainingSeconds: number;
  readingCount: number;
};

type MotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const PROTOCOL_DURATION_MS = 8_000;
const READING_INTERVAL_MS = 250;
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const spread = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : 0;

function relativeSoundLevel(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer);
  const rms = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length);
  return Math.max(28, Math.min(92, 20 * Math.log10(Math.max(rms, 0.00001)) + 92));
}

function relativeBrightness(context: CanvasRenderingContext2D, video: HTMLVideoElement) {
  context.drawImage(video, 0, 0, 32, 32);
  const pixels = context.getImageData(0, 0, 32, 32).data;
  let luminance = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    luminance += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
  }
  return (luminance / (pixels.length / 4) / 255) * 100;
}

export async function capturePhysicalReading(
  label: string,
  phase: SamplePhase,
  onProgress?: (progress: CaptureProgress) => void,
): Promise<PhysicalReading> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera and microphone capture are not available in this browser.");
  }

  onProgress?.({ stage: "permission", progress: 0, remainingSeconds: 8, readingCount: 0 });

  let motionAvailable = "DeviceMotionEvent" in window;
  const motionIntensities: number[] = [];
  const motionConstructor = window.DeviceMotionEvent as MotionEventWithPermission | undefined;
  if (motionConstructor?.requestPermission) {
    try {
      motionAvailable = await motionConstructor.requestPermission() === "granted";
    } catch {
      motionAvailable = false;
    }
  }

  const onMotion = (event: DeviceMotionEvent) => {
    const rotation = event.rotationRate;
    if (!rotation) return;
    const magnitude = Math.sqrt(
      (rotation.alpha ?? 0) ** 2
      + (rotation.beta ?? 0) ** 2
      + (rotation.gamma ?? 0) ** 2,
    );
    if (Number.isFinite(magnitude)) motionIntensities.push(magnitude);
  };
  if (motionAvailable) window.addEventListener("devicemotion", onMotion);

  let wakeLock: WakeLockSentinel | undefined;
  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      // Capture remains usable if the platform declines the wake lock.
    }
  }

  let stream: MediaStream | undefined;
  let audioContext: AudioContext | undefined;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("The browser could not prepare the light instrument.");

    onProgress?.({ stage: "settling", progress: 0, remainingSeconds: 8, readingCount: 0 });
    await wait(700);

    const soundLevels: number[] = [];
    const brightnessLevels: number[] = [];
    const audioBuffer = new Float32Array(analyser.fftSize);
    const startedAt = performance.now();

    while (performance.now() - startedAt < PROTOCOL_DURATION_MS) {
      soundLevels.push(relativeSoundLevel(analyser, audioBuffer));
      brightnessLevels.push(relativeBrightness(context, video));
      const elapsed = performance.now() - startedAt;
      onProgress?.({
        stage: "sampling",
        progress: Math.min(1, elapsed / PROTOCOL_DURATION_MS),
        remainingSeconds: Math.max(0, Math.ceil((PROTOCOL_DURATION_MS - elapsed) / 1000)),
        readingCount: soundLevels.length,
      });
      await wait(READING_INTERVAL_MS);
    }

    const durationMs = Math.round(performance.now() - startedAt);
    const observedMotion = motionAvailable && motionIntensities.length >= 3;
    const meanMotion = observedMotion
      ? motionIntensities.reduce((sum, value) => sum + value, 0) / motionIntensities.length
      : 0;
    const steadiness = observedMotion ? Math.round(Math.max(0, 100 - Math.min(100, meanMotion * 3))) : 82;
    const soundDb = Math.round(median(soundLevels));
    const brightness = Math.round(median(brightnessLevels));
    const quality = assessEvidenceQuality({
      source: "physical",
      durationMs,
      readingCount: Math.min(soundLevels.length, brightnessLevels.length),
      soundSpread: spread(soundLevels),
      lightSpread: spread(brightnessLevels),
      steadiness,
      motionAvailable: observedMotion,
    });

    onProgress?.({ stage: "sampling", progress: 1, remainingSeconds: 0, readingCount: soundLevels.length });
    return { label, phase, source: "physical", soundDb, brightness, steadiness, quality };
  } finally {
    if (motionAvailable) window.removeEventListener("devicemotion", onMotion);
    stream?.getTracks().forEach((track) => track.stop());
    await audioContext?.close().catch(() => undefined);
    await wakeLock?.release().catch(() => undefined);
  }
}
