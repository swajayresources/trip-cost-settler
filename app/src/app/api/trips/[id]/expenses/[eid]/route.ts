import { prisma } from "@/lib/db";
import { UpdateExpenseSchema } from "@/lib/schemas";
import { ok, notFound, conflict, badRequest, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; eid: string }> };

export async function PUT(req: Request, { params }: Params) {
  const { id, eid } = await params;
  const parsed = await parseBody(req, UpdateExpenseSchema);
  if (!("data" in parsed)) return parsed;

  const expense = await prisma.expense.findFirst({
    where: { id: eid, tripId: id },
  });
  if (!expense) return notFound("Expense");

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return notFound("Trip");

  if (!["DRAFT", "VERIFIED"].includes(trip.status)) {
    return conflict("Cannot edit expenses after trip is settled");
  }

  const { payerId, description, amountCents, participantIds } = parsed.data;

  // Validate payer if changing
  if (payerId) {
    const payer = await prisma.participant.findFirst({ where: { id: payerId, tripId: id } });
    if (!payer) return badRequest("Payer not found in this trip");
  }

  // Validate participants if changing
  if (participantIds) {
    const count = await prisma.participant.count({
      where: { id: { in: participantIds }, tripId: id },
    });
    if (count !== participantIds.length) {
      return badRequest("One or more participants not found in this trip");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (participantIds) {
      await tx.expenseParticipant.deleteMany({ where: { expenseId: eid } });
      const uniqueIds = [...new Set(participantIds)];
      await tx.expenseParticipant.createMany({
        data: uniqueIds.map((pid) => ({ expenseId: eid, participantId: pid })),
      });
    }

    return tx.expense.update({
      where: { id: eid },
      data: {
        ...(payerId && { payerId }),
        ...(description && { description }),
        ...(amountCents && { amountCents }),
      },
      include: {
        payer: true,
        participants: { include: { participant: true } },
      },
    });
  });

  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, eid } = await params;

  const expense = await prisma.expense.findFirst({ where: { id: eid, tripId: id } });
  if (!expense) return notFound("Expense");

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return notFound("Trip");

  if (!["DRAFT", "VERIFIED"].includes(trip.status)) {
    return conflict("Cannot delete expenses after trip is settled");
  }

  await prisma.expense.delete({ where: { id: eid } });
  return ok({ deleted: true });
}
