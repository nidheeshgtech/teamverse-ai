import { isDevPreviewEnabled } from "@/lib/env";

export const SIGN_IN_PATH = "/sign-in";

const publicPrefixes = [SIGN_IN_PATH, "/invite/"];

export function isPublicPath(pathname: string): boolean {
  if (isDevPreviewEnabled() && pathname.startsWith("/dev/")) return true;
  return publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

/** Only allow same-origin relative redirects after sign-in (prevents open redirects). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
