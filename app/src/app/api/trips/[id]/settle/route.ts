import { prisma } from "@/lib/db";
import { calculateSettlements } from "@/lib/settlement-algorithm";
import { ok, notFound, conflict, badRequest } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      participants: true,
      expenses: {
        include: { participants: { include: { participant: true } } },
      },
    },
  });
  if (!trip) return notFound("Trip");

  if (trip.status !== "VERIFIED") {
    return conflict("Trip must be verified before settling");
  }

  if (trip.expenses.length === 0) {
    return badRequest("No expenses to settle");
  }

  // Map Prisma expenses to the algorithm's shape
  const algorithmExpenses = trip.expenses.map((e) => ({
    id: e.id,
    payerId: e.payerId,
    amountCents: e.amountCents,
    participants: e.participants.map((ep) => ({ id: ep.participantId })),
  }));

  const payments = calculateSettlements(algorithmExpenses);

  const settlement = await prisma.$transaction(async (tx) => {
    const newSettlement = await tx.settlement.create({
      data: {
        tripId: id,
        version: 1,
        status: "ACTIVE",
        payments: {
          create: payments.map((p) => ({
            fromId: p.fromId,
            toId: p.toId,
            amountCents: p.amountCents,
          })),
        },
      },
      include: {
        payments: {
          include: {
            from: true,
            to: true,
          },
        },
      },
    });

    await tx.trip.update({ where: { id }, data: { status: "SETTLED" } });

    return newSettlement;
  });

  return ok(settlement, 201);
}
