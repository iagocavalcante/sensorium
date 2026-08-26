import type { SamplePhase } from "./store";

export type PhysicalReading = {
  label: string;
  soundDb: number;
  brightness: number;
  steadiness: number;
  phase: SamplePhase;
  source: "physical";
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function capturePhysicalReading(label: string, phase: SamplePhase): Promise<PhysicalReading> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera and microphone capture are not available in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
  });

  try {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    await wait(700);

    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const soundDb = Math.round(Math.max(28, Math.min(92, 20 * Math.log10(Math.max(rms, 0.00001)) + 92)));

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await wait(250);
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context?.drawImage(video, 0, 0, 32, 32);
    const pixels = context?.getImageData(0, 0, 32, 32).data;
    let brightness = 50;
    if (pixels) {
      let luminance = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        luminance += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
      }
      brightness = Math.round((luminance / (pixels.length / 4) / 255) * 100);
    }

    await audioContext.close();
    return { label, phase, source: "physical", soundDb, brightness, steadiness: 82 };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

