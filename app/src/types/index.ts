export interface Participant {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
}

export interface ExpenseParticipant {
  participant: Participant;
}

export interface Expense {
  id: string;
  description: string;
  amountCents: number;
  isLateAddition: boolean;
  createdAt: string;
  payer: Participant;
  participants: ExpenseParticipant[];
}

export type TripStatus = "DRAFT" | "VERIFIED" | "SETTLED" | "RESETTLED";

export interface Trip {
  id: string;
  title: string;
  status: TripStatus;
  currency: string;
  shareToken: string;
  rawText: string;
  createdAt: string;
  participants: Participant[];
  expenses: Expense[];
}

export type PaymentStatus = "PENDING" | "CONFIRMED";

export interface Payment {
  id: string;
  amountCents: number;
  status: PaymentStatus;
  confirmedAt: string | null;
  from: Participant;
  to: Participant;
}

export interface Settlement {
  id: string;
  version: number;
  status: string;
  payments: Payment[];
  createdAt: string;
}
