import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a URL-safe share token (21 chars = 126 bits entropy) */
export function generateShareToken(): string {
  return nanoid(21);
}

/** Generate a short cuid-style ID */
export function generateId(): string {
  return nanoid(12);
}

/** Normalize a participant name for deduplication */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Format cents as a dollar string: 4550 → "$45.50" */
export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Parse a dollar string to cents: "$45.50" → 4550. Throws on unparseable input. */
export function parseToCents(value: string | number): number {
  if (typeof value === "number") {
    if (isNaN(value)) throw new Error(`Cannot parse NaN as a currency amount`);
    return Math.round(value * 100);
  }
  const cleaned = value.replace(/[^0-9.]/g, "");
  const result = Math.round(parseFloat(cleaned) * 100);
  if (isNaN(result)) throw new Error(`Cannot parse "${value}" as a currency amount`);
  return result;
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
