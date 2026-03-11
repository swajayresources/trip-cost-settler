import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { LLMExtractionResultSchema, type LLMExtractionResult } from "./schemas";

// ─── Shared ───────────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly code: "NO_TOOL_CALL" | "VALIDATION_FAILED" | "API_ERROR" | "TIMEOUT"
  ) {
    super(message);
    this.name = "ParseError";
  }
}

const SYSTEM_PROMPT = `You are an expense parser for group trips.
You receive raw, informal text describing shared expenses — copied from chat messages, notes, or receipts.

Extract every expense mentioned, identifying:
- WHO paid (normalize names: "dan", "Daniel", "danny" → "Daniel")
- WHAT it was for (brief description)
- HOW MUCH (convert to integer cents: $45.50 → 4550)
- WHO participated (if not stated, use an empty array to mean "everyone")

Rules:
- Normalize names consistently. Pick the most formal/complete version seen in the text.
- Self-references like "me", "I", "myself" refer to the person describing the expense — infer their name from context.
- Convert all amounts to integer cents. "$45.50" → 4550, "around $60" → 6000.
- Default currency is USD unless another is clearly stated. For Australian dollars use AUD.
- Mark expenses as needsReview: true only when genuinely ambiguous (amount unclear, payer unknown).
- Always call the extract_expenses tool. Never respond with plain text.`;

/** Anthropic-typed tool definition */
const ANTHROPIC_TOOL: Anthropic.Tool = {
  name: "extract_expenses",
  description: "Extract structured expense data from raw trip text",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Short trip title inferred from context (e.g. 'Byron Bay Trip')",
      },
      currency: {
        type: "string",
        description: "Primary ISO 4217 currency code detected. Default: USD",
      },
      participants: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Normalized display name" },
            aliases: {
              type: "array",
              items: { type: "string" },
              description: "Other names/nicknames found in the text for this person",
            },
          },
          required: ["name"],
        },
      },
      expenses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            payerName: { type: "string" },
            description: { type: "string" },
            amountCents: { type: "integer", description: "Amount in cents. $45.50 → 4550" },
            participantNames: {
              type: "array",
              items: { type: "string" },
              description: "Names of participants. Empty array means everyone.",
            },
            needsReview: { type: "boolean", description: "True if this expense was ambiguous" },
          },
          required: ["payerName", "description", "amountCents", "participantNames", "needsReview"],
        },
      },
    },
    required: ["title", "currency", "participants", "expenses"],
  },
};

function validateOutput(raw: unknown): LLMExtractionResult {
  const parsed = LLMExtractionResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ParseError(
      `LLM output failed validation: ${parsed.error.message}`,
      "VALIDATION_FAILED"
    );
  }
  return parsed.data;
}

// ─── Anthropic provider ───────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

async function callAnthropic(rawText: string): Promise<LLMExtractionResult> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: rawText }],
    tools: [ANTHROPIC_TOOL],
    tool_choice: { type: "any" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new ParseError("Model did not call the extract_expenses tool", "NO_TOOL_CALL");
  }

  return validateOutput(toolUse.input);
}

// ─── Groq provider ────────────────────────────────────────────────────────────

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

async function callGroq(rawText: string): Promise<LLMExtractionResult> {
  const client = getGroqClient();
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: rawText },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "extract_expenses",
          description: "Extract structured expense data from raw trip text",
          // Reuse the same schema from the Anthropic tool definition
          parameters: ANTHROPIC_TOOL.input_schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_expenses" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new ParseError("Groq model did not call the extract_expenses tool", "NO_TOOL_CALL");
  }

  let args: unknown;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new ParseError("Groq returned invalid JSON in tool call arguments", "VALIDATION_FAILED");
  }

  return validateOutput(args);
}

// ─── Provider selector + retry ────────────────────────────────────────────────

type Provider = "anthropic" | "groq";

function detectProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  throw new ParseError(
    "No LLM API key configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY in .env.local",
    "API_ERROR"
  );
}

async function callLLM(rawText: string, provider: Provider): Promise<LLMExtractionResult> {
  return provider === "anthropic" ? callAnthropic(rawText) : callGroq(rawText);
}

/**
 * Parse raw trip text using the configured LLM provider.
 * Priority: ANTHROPIC_API_KEY → GROQ_API_KEY
 * Retries once with a stronger prompt if the model skips the tool call.
 * Throws ParseError on unrecoverable failure.
 */
export async function parseExpenses(rawText: string): Promise<LLMExtractionResult> {
  const provider = detectProvider();

  try {
    return await callLLM(rawText, provider);
  } catch (error) {
    if (error instanceof ParseError && error.code === "NO_TOOL_CALL") {
      // Retry once with a harder nudge
      try {
        return await callLLM(
          rawText + "\n\n[IMPORTANT: You MUST call the extract_expenses tool. Do not respond with plain text.]",
          provider
        );
      } catch (retryError) {
        if (retryError instanceof Anthropic.APIError) {
          throw new ParseError(`Anthropic API error (retry): ${retryError.message}`, "API_ERROR");
        }
        if (retryError instanceof Groq.APIError) {
          throw new ParseError(`Groq API error (retry): ${retryError.message}`, "API_ERROR");
        }
        throw retryError;
      }
    }
    if (error instanceof Anthropic.APIError) {
      throw new ParseError(`Anthropic API error: ${error.message}`, "API_ERROR");
    }
    if (error instanceof Groq.APIError) {
      throw new ParseError(`Groq API error: ${error.message}`, "API_ERROR");
    }
    throw error;
  }
}
