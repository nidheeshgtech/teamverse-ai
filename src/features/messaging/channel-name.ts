/** Final channel names: lowercase letters, digits and inner dashes, 1–80 characters. */
export const CHANNEL_NAME = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/** Turns "Client Showcase!" into "client-showcase-" as the user types (trailing dash trimmed on submit). */
export function slugifyChannel(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .slice(0, 80);
}
