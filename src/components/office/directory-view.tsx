"use client";

import { Search, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { buildOccupants, countByDepartment, filterOccupants, type OfficeData, type PresenceMap } from "@/features/office/model";
import type { PresenceConnection } from "@/features/presence/use-org-presence";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { InputWithIcon } from "@/ui/input";
import { StateMessage } from "@/ui/states";
import { ToggleGroup } from "radix-ui";
import { ProfileDock } from "./profile-dock";
import { departmentTone, useDepartmentLabel } from "./use-labels";

type Props = {
  data: OfficeData;
  viewerId: string;
  presence: PresenceMap;
  connection: PresenceConnection | "simulated";
  onMessage?: (userId: string) => Promise<boolean>;
};

const chip =
  "inline-flex h-8 shrink-0 items-center gap-space-xs whitespace-nowrap rounded px-space-sm type-label-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface data-[state=on]:bg-primary-container data-[state=on]:font-semibold data-[state=on]:text-on-primary-action";

// DESIGN GAP: Stitch shows "Team Directory" in navigation only. Built from the people list,
// department chips and the profile panel of the office screen.
export function DirectoryView({ data, viewerId, presence, connection, onMessage }: Props) {
  const t = useTranslations();
  const deptLabel = useDepartmentLabel();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const occupants = useMemo(() => buildOccupants(data, presence), [data, presence]);
  const visible = useMemo(() => filterOccupants(occupants, department, query), [occupants, department, query]);
  const counts = useMemo(() => countByDepartment(occupants), [occupants]);
  const departments = [...data.departments].sort((a, b) => a.sortOrder - b.sortOrder).map((d) => d.slug).filter((slug) => counts.has(slug));
  const selected = occupants.find((o) => o.userId === selectedId) ?? null;
  const close = useCallback(() => setSelectedId(null), []);

  return (
    <div className="flex gap-gutter">
      <div className="flex min-w-0 flex-1 flex-col gap-space-md">
        <div className="flex flex-wrap items-center gap-space-sm">
          <InputWithIcon
            icon={<Search />}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("office.searchPeople")}
            aria-label={t("office.searchPeople")}
            className="w-full sm:w-80"
          />
          <ToggleGroup.Root
            type="single"
            aria-label={t("office.filtersLabel")}
            value={department ?? "all"}
            onValueChange={(v) => v && setDepartment(v === "all" ? null : v)}
            className="glass-level-1 flex gap-space-2xs rounded-md p-space-2xs max-md:w-full max-md:overflow-x-auto max-md:[scrollbar-width:none] md:flex-wrap"
          >
            <ToggleGroup.Item value="all" className={chip}>{t("office.allRooms")}</ToggleGroup.Item>
            {departments.map((slug) => (
              <ToggleGroup.Item key={slug} value={slug} className={chip}>{deptLabel(slug)}</ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <Badge tone={connection === "live" ? "primary" : "warning"} className="ms-auto">{t(`office.connection.${connection}`)}</Badge>
        </div>

        <p className="type-label-md text-on-surface-variant" aria-live="polite">{t("office.peopleCount", { count: visible.length })}</p>

        {visible.length === 0 ? (
          <StateMessage icon={<Users />} title={t("office.noResults", { query })} />
        ) : (
          <ul className="grid grid-cols-1 gap-gutter sm:grid-cols-2 2xl:grid-cols-3">
            {visible.map((person) => (
              <li key={person.userId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(person.userId)}
                  aria-current={person.userId === selectedId ? "true" : undefined}
                  className="glass-level-2 flex w-full items-center gap-space-md rounded-lg p-space-md text-start hover:border-surface-glass-highlight aria-[current=true]:border-primary-container"
                >
                  <Avatar name={person.displayName} src={person.avatarUrl} size="lg" status={person.status} statusLabel={t(`presence.${person.status}`)} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-title-md text-on-surface">{person.displayName}</span>
                    <span className="block truncate type-body-sm text-on-surface-variant">{person.title}</span>
                    <span className="mt-space-xs flex flex-wrap items-center gap-space-xs">
                      {person.departmentSlug ? <Badge tone={departmentTone(person.departmentSlug)}>{deptLabel(person.departmentSlug)}</Badge> : null}
                      <span className="type-label-md text-on-surface-variant">{t(`presence.${person.status}`)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        // Desktop: sticky column. Phones/tablets: a bottom sheet.
        <ProfileDock
          desktopClassName="w-panel-lg shrink-0 [&>*]:sticky [&>*]:top-[calc(var(--spacing-topbar)+var(--spacing-margin))]"
          person={selected}
          isSelf={selected.userId === viewerId}
          canFocusDesk={false}
          onFocusDesk={() => undefined}
          onClose={close}
          onMessage={onMessage}
        />
      ) : null}
    </div>
  );
}
