import { presenceStatuses, type PresenceStatus } from "@/ui/presence";

export const AVAILABILITY_EVENT = "tv:availability";

export function presenceTopic(orgId: string) {
  return `org:${orgId}:presence`;
}

/** Announces a user-chosen availability change to listeners on this page (e.g. the presence channel). */
export function announceAvailability(status: PresenceStatus) {
  window.dispatchEvent(new CustomEvent<PresenceStatus>(AVAILABILITY_EVENT, { detail: status }));
}

type RawPresenceState = Record<string, Array<{ status?: unknown }>>;

/**
 * Converts Supabase presence state (key = user id, one entry per open tab) into userId → status.
 * Invalid payloads are ignored; "offline" entries are dropped (that user chose to appear offline).
 */
export function statusesFromPresenceState(state: RawPresenceState): Map<string, PresenceStatus> {
  const result = new Map<string, PresenceStatus>();
  for (const [userId, entries] of Object.entries(state)) {
    const latest = entries.at(-1)?.status;
    const status = presenceStatuses.find((s) => s === latest);
    if (status && status !== "offline") result.set(userId, status);
  }
  return result;
}
