import { prisma } from "@/lib/db";
import { UpdateParticipantSchema } from "@/lib/schemas";
import { ok, notFound, conflict, parseBody } from "@/lib/api-helpers";
import { normalizeName } from "@/lib/utils";

type Params = { params: Promise<{ id: string; pid: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id, pid } = await params;
  const parsed = await parseBody(req, UpdateParticipantSchema);
  if (!("data" in parsed)) return parsed;

  const participant = await prisma.participant.findFirst({
    where: { id: pid, tripId: id },
  });
  if (!participant) return notFound("Participant");

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return notFound("Trip");

  if (!["DRAFT", "VERIFIED"].includes(trip.status)) {
    return conflict("Cannot rename participants after trip is settled");
  }

  const normalized = normalizeName(parsed.data.name);

  const updated = await prisma.participant.update({
    where: { id: pid },
    data: { name: parsed.data.name, normalizedName: normalized },
  });

  return ok(updated);
}
