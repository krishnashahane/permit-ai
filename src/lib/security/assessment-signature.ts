import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production.");
  }
  return "permit-ai-local-dev-secret";
}

export function signAssessment(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verifyAssessmentSignature(payload: string, signature: string): boolean {
  const expected = signAssessment(payload);
  const actual = Buffer.from(signature || "");
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
