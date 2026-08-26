import { compareSamples, sensoriumStore } from "./store";

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const stringField = (description: string) => ({ type: "string", description });

export async function registerSensoriumTools() {
  if (typeof document.modelContext?.registerTool !== "function") return false;

  const tools: WebMCPTool[] = [
    {
      name: "inspect_capabilities",
      title: "Inspect field instruments",
      description: "Read which browser instruments and WebMCP capabilities are available. Does not request permission.",
      inputSchema: objectSchema({}),
      annotations: { readOnlyHint: true },
      execute: () => ({
        webmcp: true,
        secureContext: window.isSecureContext,
        cameraAndMicrophone: Boolean(navigator.mediaDevices?.getUserMedia),
        geolocation: "geolocation" in navigator,
        bluetooth: "bluetooth" in navigator,
        note: "Camera, microphone, location, and Bluetooth permission must be granted by the person in the page.",
      }),
    },
    {
      name: "create_investigation",
      title: "Create investigation",
      description: "Start a visible environmental investigation for the person and agent to conduct together.",
      inputSchema: objectSchema(
        { title: stringField("A short field-study title."), question: stringField("The testable question to investigate.") },
        ["title", "question"],
      ),
      execute: ({ title, question }) => sensoriumStore.startInvestigation(String(title), String(question)),
    },
    {
      name: "request_observation",
      title: "Request human observation",
      description: "Place one clear physical action on the shared mission card for the person to perform.",
      inputSchema: objectSchema({ prompt: stringField("One concise, safe physical observation or measurement request.") }, ["prompt"]),
      execute: ({ prompt }) => {
        sensoriumStore.requestObservation(String(prompt));
        return { displayed: true, prompt };
      },
    },
    {
      name: "capture_sample",
      title: "Capture sample",
      description: "Add a simulated sample, or ask the person to capture a physical camera and microphone reading. Physical sensor permission requires human interaction in the page.",
      inputSchema: objectSchema(
        {
          label: stringField("Human-readable location or condition label."),
          mode: { type: "string", enum: ["simulated", "physical"], description: "Use simulated for demonstration data or physical for a human-authorized reading." },
          phase: { type: "string", enum: ["baseline", "intervention"] },
        },
        ["label", "mode", "phase"],
      ),
      execute: ({ label, mode, phase }) => {
        if (mode === "physical") {
          const prompt = `Capture the physical reading labeled “${String(label)}” using the orange button.`;
          sensoriumStore.requestObservation(prompt);
          return { status: "needs_user_action", prompt, reason: "Browser sensor permission requires a person in the page." };
        }
        return { status: "captured", sample: sensoriumStore.addSimulatedSample(String(label), phase === "intervention" ? "intervention" : "baseline") };
      },
    },
    {
      name: "compare_samples",
      title: "Compare evidence",
      description: "Compare all current environmental samples and rank their habitat scores.",
      inputSchema: objectSchema({}),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => compareSamples(),
    },
    {
      name: "annotate_evidence",
      title: "Annotate evidence",
      description: "Add a concise agent interpretation to the visible evidence ledger.",
      inputSchema: objectSchema({ text: stringField("Evidence-grounded interpretation visible to the person.") }, ["text"]),
      execute: ({ text }) => {
        sensoriumStore.annotate(String(text));
        return { recorded: true, text };
      },
    },
    {
      name: "propose_intervention",
      title: "Propose intervention",
      description: "Propose one reversible environmental change and prepare the page for a verification reading.",
      inputSchema: objectSchema({ text: stringField("A safe, specific, reversible change to test.") }, ["text"]),
      execute: ({ text }) => {
        sensoriumStore.proposeIntervention(String(text));
        return { displayed: true, intervention: text, next: "Ask the person to apply it and capture a verification reading." };
      },
    },
    {
      name: "record_outcome",
      title: "Record outcome",
      description: "Record a simulated post-intervention verification sample in the visible evidence board.",
      inputSchema: objectSchema({ label: stringField("Label describing the verified condition.") }, ["label"]),
      execute: ({ label }) => ({ status: "captured", sample: sensoriumStore.addSimulatedSample(String(label), "intervention") }),
    },
    {
      name: "export_evidence_capsule",
      title: "Prepare evidence capsule",
      description: "Return the current investigation as structured local-first evidence. This does not upload or share data.",
      inputSchema: objectSchema({}),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => {
        const current = sensoriumStore.getSnapshot();
        return {
          status: "ready_for_human_export",
          instruction: "The person can use Export evidence in the page to download the complete local JSON capsule.",
          investigation: {
            id: current.investigation.id,
            title: current.investigation.title,
            status: current.investigation.status,
          },
          sampleCount: current.samples.length,
          comparison: compareSamples(current.samples),
        };
      },
    },
  ];

  await Promise.all(tools.map((tool) => document.modelContext!.registerTool(tool)));
  return true;
}
