"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PresenceStatus } from "@/ui/presence";
import { AVAILABILITY_EVENT, presenceTopic, statusesFromPresenceState } from "./presence-state";

export type PresenceConnection = "connecting" | "live" | "error" | "unconfigured";

/**
 * Ephemeral org presence over a private Supabase Realtime channel. Shares only the availability
 * the user chose (or nothing, if they chose "offline"). Never persisted.
 */
export function useOrgPresence(orgId: string, userId: string, initialAvailability: PresenceStatus) {
  const [statuses, setStatuses] = useState<Map<string, PresenceStatus>>(() => new Map());
  const [connection, setConnection] = useState<PresenceConnection>(() => (isSupabaseConfigured() ? "connecting" : "unconfigured"));
  const availability = useRef(initialAvailability);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel: RealtimeChannel = supabase.channel(presenceTopic(orgId), {
      config: { private: true, presence: { key: userId } },
    });

    const share = async () => {
      if (availability.current === "offline") await channel.untrack();
      else await channel.track({ status: availability.current });
    };

    channel
      .on("presence", { event: "sync" }, () => setStatuses(statusesFromPresenceState(channel.presenceState())))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          void share();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("error");
        } else if (status === "CLOSED") {
          setConnection("connecting");
        }
      });

    const onAvailability = (event: Event) => {
      availability.current = (event as CustomEvent<PresenceStatus>).detail;
      void share();
    };
    window.addEventListener(AVAILABILITY_EVENT, onAvailability);

    return () => {
      window.removeEventListener(AVAILABILITY_EVENT, onAvailability);
      void supabase.removeChannel(channel);
    };
  }, [orgId, userId]);

  return { statuses, connection };
}
