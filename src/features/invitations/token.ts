import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_DAYS = 7;

/** 256-bit random token, URL-safe. Only its hash is stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Must match public.accept_invitation / invitation_preview: lowercase hex SHA-256 of the raw token. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Cheap shape check before touching the database. */
export function looksLikeInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
