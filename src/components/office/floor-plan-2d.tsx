"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { sceneBounds, type Occupant, type Room } from "@/features/office/model";
import { Avatar } from "@/ui/avatar";
import { useDepartmentLabel } from "./use-labels";

type Props = {
  rooms: Room[];
  occupants: Occupant[];
  departmentFilter: string | null;
  selectedId: string | null;
  onSelect: (userId: string) => void;
};

/**
 * 2D fallback: rooms drawn to scale from the layout, people as focusable buttons inside them.
 * Used when WebGL is unavailable, in performance-sensitive contexts, or by choice.
 * DESIGN GAP: Stitch has a "2D Grid" toggle but no 2D design; this extends the HUD card style.
 */
export function FloorPlan2D({ rooms, occupants, departmentFilter, selectedId, onSelect }: Props) {
  const t = useTranslations();
  const deptLabel = useDepartmentLabel();
  const bounds = useMemo(() => sceneBounds(rooms), [rooms]);
  const byRoom = useMemo(() => {
    const map = new Map<string, Occupant[]>();
    for (const o of occupants) {
      const key = o.seat?.departmentSlug;
      if (key) map.set(key, [...(map.get(key) ?? []), o]);
    }
    return map;
  }, [occupants]);

  // Percent geometry so the plan scales with its container. Inline styles carry layout data, not tokens.
  // The plan is a map of physical space and, like the 3D scene, is intentionally NOT mirrored in RTL.
  const pct = (value: number, span: number) => `${(value / span) * 100}%`;

  return (
    // Size container: the plan keeps the layout's aspect ratio and fits both dimensions.
    <div className="relative flex size-full items-start justify-center" style={{ containerType: "size" }} role="region" aria-label={t("office.view2d")}>
      <div
        className="relative"
        style={{
          width: `min(100cqw, calc(100cqh * ${bounds.width / bounds.depth}))`,
          aspectRatio: `${bounds.width} / ${bounds.depth}`,
        }}
      >
        {rooms.map((room) => {
          const people = byRoom.get(room.department) ?? [];
          const dimmed = departmentFilter !== null && departmentFilter !== room.department;
          return (
            <section
              key={room.department}
              aria-label={`${deptLabel(room.department)} · ${t("office.roomPeople", { count: people.length })}`}
              data-dimmed={dimmed}
              className="glass-level-1 absolute flex flex-col gap-space-xs overflow-auto rounded-lg p-space-sm transition-opacity data-[dimmed=true]:opacity-40"
              style={{
                left: pct(room.x - room.width / 2 - bounds.minX, bounds.width),
                top: pct(room.z - room.depth / 2 - bounds.minZ, bounds.depth),
                width: pct(room.width, bounds.width),
                height: pct(room.depth, bounds.depth),
                borderColor: `var(--tv-color-dept-${room.department}, var(--tv-color-surface-glass-border))`,
              }}
            >
              <h3 className="type-label-md text-on-surface">
                {deptLabel(room.department)} <span className="text-on-surface-variant">· {t("office.roomPeople", { count: people.length })}</span>
              </h3>
              <ul className="flex flex-wrap gap-space-xs">
                {people.map((person) => (
                  <li key={person.userId}>
                    <button
                      type="button"
                      onClick={() => onSelect(person.userId)}
                      aria-current={person.userId === selectedId ? "true" : undefined}
                      className="flex items-center gap-space-xs rounded-full bg-surface-container-low py-space-2xs pe-space-sm ps-space-2xs hover:bg-surface-container-high aria-[current=true]:outline-2 aria-[current=true]:outline-primary"
                    >
                      <Avatar name={person.displayName} src={person.avatarUrl} size="sm" status={person.status} statusLabel={t(`presence.${person.status}`)} decorative />
                      <span className="type-label-md text-on-surface">{person.displayName}</span>
                      <span className="sr-only">{t(`presence.${person.status}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
