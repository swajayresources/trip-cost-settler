import { prisma } from "@/lib/db";
import { ok, notFound, conflict, badRequest } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      participants: true,
      expenses: { include: { participants: true } },
    },
  });
  if (!trip) return notFound("Trip");

  if (trip.status !== "DRAFT") {
    return conflict(`Trip is already ${trip.status.toLowerCase()}`);
  }

  if (trip.participants.length < 2) {
    return badRequest("Trip needs at least 2 participants before verifying");
  }
  if (trip.expenses.length < 1) {
    return badRequest("Trip needs at least 1 expense before verifying");
  }

  const updated = await prisma.trip.update({
    where: { id },
    data: { status: "VERIFIED" },
  });

  return ok(updated);
}
