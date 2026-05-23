import { randomBytes } from "crypto";

export function generateInviteToken(): string {
  // URL-safe 32-char token (192 bits of entropy).
  return randomBytes(24).toString("base64url");
}

export function inviteUrl(token: string, baseUrl?: string) {
  const base = baseUrl ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

export const INVITE_TTL_DAYS = 14;
export function inviteExpiry(): Date {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
