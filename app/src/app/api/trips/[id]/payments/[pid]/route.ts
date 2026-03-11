import { prisma } from "@/lib/db";
import { ConfirmPaymentSchema } from "@/lib/schemas";
import { ok, notFound, conflict, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; pid: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id, pid } = await params;
  const parsed = await parseBody(req, ConfirmPaymentSchema);
  if (!("data" in parsed)) return parsed;

  // Verify payment belongs to this trip via its settlement
  const payment = await prisma.payment.findFirst({
    where: {
      id: pid,
      settlement: { tripId: id },
    },
  });
  if (!payment) return notFound("Payment");

  // Immutability: once confirmed, cannot change
  if (payment.status === "CONFIRMED") {
    return conflict("Payment is already confirmed and cannot be changed");
  }

  const updated = await prisma.payment.update({
    where: { id: pid },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
    include: { from: true, to: true },
  });

  return ok(updated);
}
