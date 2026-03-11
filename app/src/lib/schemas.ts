import { z } from "zod";

// ─── Trip ───────────────────────────────────────────────────────────────────

export const CreateTripSchema = z.object({
  rawText: z
    .string()
    .min(10, "Please paste at least some trip text")
    .max(20_000, "Text is too long — please trim to under 20,000 characters"),
  title: z.string().max(200).optional(),
});

export const UpdateTripSchema = z.object({
  title: z.string().max(200).optional(),
  currency: z.string().length(3).optional(),
});

// ─── Expense ─────────────────────────────────────────────────────────────────

export const CreateExpenseSchema = z.object({
  payerId: z.string().min(1),
  description: z.string().min(1).max(500),
  amountCents: z.number().int().positive().max(10_000_000), // max $100,000
  participantIds: z.array(z.string().min(1)).min(1),
  isLateAddition: z.boolean().optional().default(false),
});

export const UpdateExpenseSchema = z.object({
  payerId: z.string().min(1).optional(),
  description: z.string().min(1).max(500).optional(),
  amountCents: z.number().int().positive().max(10_000_000).optional(),
  participantIds: z.array(z.string().min(1)).min(1).optional(),
});

// ─── Participant ─────────────────────────────────────────────────────────────

export const UpdateParticipantSchema = z.object({
  name: z.string().min(1).max(100),
});

// ─── Payment ─────────────────────────────────────────────────────────────────

export const ConfirmPaymentSchema = z.object({
  status: z.literal("CONFIRMED"),
});

// ─── LLM Output ──────────────────────────────────────────────────────────────

export const LLMParticipantSchema = z.object({
  name: z.string().min(1).max(100),
  aliases: z.array(z.string()).default([]),
});

export const LLMExpenseSchema = z.object({
  payerName: z.string().min(1),
  description: z.string().min(1).max(500),
  amountCents: z.number().int().nonnegative().max(10_000_000),
  participantNames: z.array(z.string()),
  needsReview: z.boolean(),
});

export const LLMExtractionResultSchema = z.object({
  title: z.string().min(1).max(200).default("Group Trip"),
  currency: z.string().length(3).default("USD"),
  participants: z.array(LLMParticipantSchema).min(1),
  expenses: z.array(LLMExpenseSchema).min(1),
});

export type LLMExtractionResult = z.infer<typeof LLMExtractionResultSchema>;
export type CreateTripInput = z.infer<typeof CreateTripSchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
