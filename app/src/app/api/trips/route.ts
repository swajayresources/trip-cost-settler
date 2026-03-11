import { prisma } from "@/lib/db";
import { parseExpenses, ParseError } from "@/lib/parse-expenses";
import { CreateTripSchema } from "@/lib/schemas";
import { generateShareToken, normalizeName } from "@/lib/utils";
import { ok, badRequest, serverError, parseBody } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const parsed = await parseBody(req, CreateTripSchema);
  if (!("data" in parsed)) return parsed;
  const { rawText, title } = parsed.data;

  // Parse with Claude
  let extraction;
  try {
    extraction = await parseExpenses(rawText);
  } catch (error) {
    if (error instanceof ParseError) {
      console.error("[parse error]", error.code, error.message);
      return badRequest(
        "Could not parse expenses from the provided text. Please check the format and try again.",
        { code: error.code }
      );
    }
    console.error("[unexpected error]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return serverError(`Parsing Engine Error: ${msg}`);
  }

  // Build the trip in a single transaction
  try {
    const trip = await prisma.$transaction(async (tx) => {
      const newTrip = await tx.trip.create({
        data: {
          rawText,
          title: title ?? extraction.title,
          currency: extraction.currency,
          shareToken: generateShareToken(),
        },
      });

      // Create participants, deduplicated by normalizedName
      const participantMap = new Map<string, string>(); // normalizedName → id
      for (const p of extraction.participants) {
        const normalized = normalizeName(p.name);
        if (participantMap.has(normalized)) continue;
        const participant = await tx.participant.create({
          data: { tripId: newTrip.id, name: p.name, normalizedName: normalized },
        });
        participantMap.set(normalized, participant.id);
        // Map aliases to the same participant
        for (const alias of p.aliases ?? []) {
          participantMap.set(normalizeName(alias), participant.id);
        }
      }

      // Create expenses
      for (const e of extraction.expenses) {
        const payerNorm = normalizeName(e.payerName);
        const payerId = participantMap.get(payerNorm);
        if (!payerId) continue; // skip if payer unknown (shouldn't happen after Zod validation)

        // Resolve participant IDs — empty means everyone
        const participantIds =
          e.participantNames.length === 0
            ? [...participantMap.values()]
            : e.participantNames
                .map((name) => participantMap.get(normalizeName(name)))
                .filter((id): id is string => id !== undefined);

        // Deduplicate participant IDs
        const uniqueParticipantIds = [...new Set(participantIds)];
        if (uniqueParticipantIds.length === 0) continue;

        await tx.expense.create({
          data: {
            tripId: newTrip.id,
            payerId,
            description: e.description,
            amountCents: e.amountCents,
            participants: {
              create: uniqueParticipantIds.map((pid) => ({ participantId: pid })),
            },
          },
        });
      }

      return newTrip;
    });

    return ok({ tripId: trip.id }, 201);
  } catch (error: any) {
    console.error("[prisma error]", error);
    return serverError("Database transaction failed: " + (error?.message || "Unknown error"));
  }
}
