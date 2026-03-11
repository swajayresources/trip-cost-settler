import { prisma } from "@/lib/db";
import { resolveLateExpense } from "@/lib/late-expense-resolver";
import { ok, notFound, conflict } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/trips/[id]/resettle
 * Triggered after a late expense is added (isLateAddition=true).
 * Carries forward confirmed payments, produces incremental new ones.
 */
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      expenses: {
        include: { participants: true },
      },
    },
  });
  if (!trip) return notFound("Trip");

  if (!["SETTLED", "RESETTLED"].includes(trip.status)) {
    return conflict("Trip must be settled before resettling");
  }

  // Get the current active settlement with all its payments
  const currentSettlement = await prisma.settlement.findFirst({
    where: { tripId: id, status: "ACTIVE" },
    include: {
      payments: { include: { from: true, to: true } },
    },
    orderBy: { version: "desc" },
  });

  if (!currentSettlement) return notFound("Active settlement");

  const confirmedPayments = currentSettlement.payments
    .filter((p) => p.status === "CONFIRMED")
    .map((p) => ({ fromId: p.fromId, toId: p.toId, amountCents: p.amountCents }));

  // Map all expenses for the resolver
  const allExpenses = trip.expenses.map((e) => ({
    id: e.id,
    payerId: e.payerId,
    amountCents: e.amountCents,
    participants: e.participants.map((ep) => ({ id: ep.participantId })),
  }));

  const { newPayments } = resolveLateExpense(allExpenses, confirmedPayments);
  const nextVersion = currentSettlement.version + 1;

  const newSettlement = await prisma.$transaction(async (tx) => {
    // Supersede the current settlement
    await tx.settlement.update({
      where: { id: currentSettlement.id },
      data: { status: "SUPERSEDED" },
    });

    // Create new settlement — carry forward confirmed payments + add new pending ones
    const created = await tx.settlement.create({
      data: {
        tripId: id,
        version: nextVersion,
        status: "ACTIVE",
        payments: {
          create: [
            // Carry forward confirmed payments verbatim
            ...currentSettlement.payments
              .filter((p) => p.status === "CONFIRMED")
              .map((p) => ({
                fromId: p.fromId,
                toId: p.toId,
                amountCents: p.amountCents,
                status: "CONFIRMED" as const,
                confirmedAt: p.confirmedAt,
              })),
            // New incremental payments
            ...newPayments.map((p) => ({
              fromId: p.fromId,
              toId: p.toId,
              amountCents: p.amountCents,
            })),
          ],
        },
      },
      include: {
        payments: { include: { from: true, to: true } },
      },
    });

    await tx.trip.update({ where: { id }, data: { status: "RESETTLED" } });

    return created;
  });

  return ok(newSettlement, 201);
}
