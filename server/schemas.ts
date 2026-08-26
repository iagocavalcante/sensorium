import * as z from "zod/v4";

const shortText = z.string().trim().min(1).max(240);

export const environmentSnapshotSchema = z.object({
  investigation: z.object({
    id: z.string().max(160),
    title: shortText,
    question: z.string().trim().min(1).max(500),
    status: z.enum(["active", "complete"]),
    createdAt: z.iso.datetime(),
  }),
  requestedObservation: z.string().max(500),
  intervention: z.string().max(500),
  samples: z.array(z.object({
    id: z.string().max(160),
    label: shortText,
    capturedAt: z.iso.datetime(),
    soundDb: z.number().finite().min(-160).max(160),
    brightness: z.number().finite().min(0).max(100),
    steadiness: z.number().finite().min(0).max(100),
    phase: z.enum(["baseline", "intervention"]),
    source: z.enum(["simulated", "physical"]),
  })).max(100),
  activity: z.array(z.object({
    id: z.string().max(160),
    at: z.iso.datetime(),
    actor: z.enum(["human", "agent", "instrument"]),
    text: z.string().max(800),
  })).max(250),
});

export const bridgeCodeSchema = z.string().trim().min(12).max(32);
export const expeditionCodeSchema = z.string().trim().min(10).max(24);
export const goalProfileSchema = z.enum(["focus", "sleep", "reading", "video_call", "recording"]);

export const bridgeOptionsSchema = z.object({
  stationLabel: z.string().trim().min(1).max(80).optional(),
  expeditionCode: expeditionCodeSchema.optional(),
});
