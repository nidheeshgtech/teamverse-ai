// Mirrors the `attachments` bucket limits in supabase/migrations/20261021000003_storage.sql.
// The bucket enforces them again server-side; this only gives early, friendly errors.

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
/** Signed download links are short-lived; the UI re-signs on demand. */
export const SIGNED_URL_TTL_SECONDS = 60 * 5;

export const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type FileProblem = "tooLarge" | "type" | "tooMany" | "empty";

export function checkFiles(files: readonly { name: string; size: number; type: string }[], alreadySelected = 0): { ok: typeof files; rejected: { name: string; problem: FileProblem }[] } {
  const ok: { name: string; size: number; type: string }[] = [];
  const rejected: { name: string; problem: FileProblem }[] = [];
  for (const file of files) {
    if (file.size === 0) rejected.push({ name: file.name, problem: "empty" });
    else if (file.size > MAX_ATTACHMENT_BYTES) rejected.push({ name: file.name, problem: "tooLarge" });
    else if (!ALLOWED_MIME_TYPES.has(file.type)) rejected.push({ name: file.name, problem: "type" });
    else if (alreadySelected + ok.length >= MAX_ATTACHMENTS) rejected.push({ name: file.name, problem: "tooMany" });
    else ok.push(file);
  }
  return { ok, rejected };
}

/**
 * Storage object name: {org}/{conversation}/{random}/{safe file name}. The first two folders are what
 * the storage policies and send_message() check; the random folder keeps names unguessable and unique.
 */
export function attachmentPath(orgId: string, conversationId: string, fileName: string, random: string = crypto.randomUUID()): string {
  return `${orgId}/${conversationId}/${random}/${safeFileName(fileName)}`;
}

export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "_")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(-120);
  return cleaned || "file";
}

export function formatBytes(bytes: number, locale = "en"): string {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: units[unit], unitDisplay: "short", maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value);
}
