import { prisma } from "@/lib/db";
import { ok, notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/share/[token]
 * Public endpoint — accessed by group members via the share URL.
 * Returns trip + active settlement + payments. No auth required.
 */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;

  const trip = await prisma.trip.findUnique({
    where: { shareToken: token },
    include: {
      participants: { orderBy: { createdAt: "asc" } },
      expenses: {
        orderBy: { createdAt: "asc" },
        include: {
          payer: true,
          participants: { include: { participant: true } },
        },
      },
    },
  });

  if (!trip) return notFound("Trip");

  const settlement = await prisma.settlement.findFirst({
    where: { tripId: trip.id, status: "ACTIVE" },
    orderBy: { version: "desc" },
    include: {
      payments: {
        include: { from: true, to: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return ok({ trip, settlement });
}
