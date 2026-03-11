import { prisma } from "@/lib/db";
import { ok, notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return notFound("Trip");

  const settlement = await prisma.settlement.findFirst({
    where: { tripId: id, status: "ACTIVE" },
    orderBy: { version: "desc" },
    include: {
      payments: {
        include: { from: true, to: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!settlement) return notFound("Settlement");
  return ok(settlement);
}
