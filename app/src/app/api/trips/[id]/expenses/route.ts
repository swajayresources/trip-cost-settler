import { prisma } from "@/lib/db";
import { CreateExpenseSchema } from "@/lib/schemas";
import { ok, notFound, badRequest, conflict, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return notFound("Trip");

  const expenses = await prisma.expense.findMany({
    where: { tripId: id },
    orderBy: { createdAt: "asc" },
    include: {
      payer: true,
      participants: { include: { participant: true } },
    },
  });

  return ok(expenses);
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const parsed = await parseBody(req, CreateExpenseSchema);
  if (!("data" in parsed)) return parsed;
  const { payerId, description, amountCents, participantIds, isLateAddition } = parsed.data;

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return notFound("Trip");

  // Only allow adding expenses in DRAFT/VERIFIED, or late additions in SETTLED/RESETTLED
  const allowedStatuses = isLateAddition
    ? ["SETTLED", "RESETTLED"]
    : ["DRAFT", "VERIFIED"];

  if (!allowedStatuses.includes(trip.status)) {
    return conflict(
      isLateAddition
        ? "Can only add late expenses after settlement is complete"
        : "Cannot add expenses after trip is settled"
    );
  }

  // Verify payer belongs to this trip
  const payer = await prisma.participant.findFirst({
    where: { id: payerId, tripId: id },
  });
  if (!payer) return badRequest("Payer not found in this trip");

  // Verify all participants belong to this trip
  const participantCount = await prisma.participant.count({
    where: { id: { in: participantIds }, tripId: id },
  });
  if (participantCount !== participantIds.length) {
    return badRequest("One or more participants not found in this trip");
  }

  const uniqueIds = [...new Set(participantIds)];

  const expense = await prisma.expense.create({
    data: {
      tripId: id,
      payerId,
      description,
      amountCents,
      isLateAddition: isLateAddition ?? false,
      participants: {
        create: uniqueIds.map((pid) => ({ participantId: pid })),
      },
    },
    include: {
      payer: true,
      participants: { include: { participant: true } },
    },
  });

  return ok(expense, 201);
}
