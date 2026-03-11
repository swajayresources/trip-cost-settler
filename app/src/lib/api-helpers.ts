import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type APIError = {
  error: string;
  code: string;
  details?: unknown;
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(error: string, code: string, status: number, details?: unknown) {
  const body: APIError = { error, code, ...(details ? { details } : {}) };
  return NextResponse.json(body, { status });
}

export function notFound(resource = "Resource") {
  return err(`${resource} not found`, "NOT_FOUND", 404);
}

export function badRequest(message: string, details?: unknown) {
  return err(message, "BAD_REQUEST", 400, details);
}

export function conflict(message: string) {
  return err(message, "CONFLICT", 409);
}

export function serverError(message = "Internal server error") {
  return err(message, "SERVER_ERROR", 500);
}

/** Parse and validate JSON body, return error response on failure */
export async function parseBody<T>(
  req: Request,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }
): Promise<{ data: T } | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return badRequest("Validation failed", result.error.flatten());
  }
  return { data: result.data };
}
