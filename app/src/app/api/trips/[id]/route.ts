import { prisma } from "@/lib/db";
import { UpdateTripSchema } from "@/lib/schemas";
import { ok, notFound, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
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
  return ok(trip);
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const parsed = await parseBody(req, UpdateTripSchema);
  if (!("data" in parsed)) return parsed;

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return notFound("Trip");

  const updated = await prisma.trip.update({
    where: { id },
    data: parsed.data,
  });

  return ok(updated);
}
