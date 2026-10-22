"use client";

import { Building2, MessageSquare, Phone, Search, Users, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useCallActions } from "@/components/calls/use-call-actions";
import { buildOccupants, countByDepartment, filterOccupants, presenceSummary, type Occupant, type OfficeData, type PresenceMap } from "@/features/office/model";
import type { PresenceConnection } from "@/features/presence/use-org-presence";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { InputWithIcon } from "@/ui/input";
import { PresenceDot, type PresenceStatus } from "@/ui/presence";
import { StateMessage } from "@/ui/states";
import { ToggleGroup } from "radix-ui";
import { ProfileDock } from "./profile-dock";
import { departmentTone, useDepartmentLabel } from "./use-labels";

type Props = {
  data: OfficeData;
  viewerId: string;
  presence: PresenceMap;
  connection: PresenceConnection | "simulated";
  /** Kept for the 3D floor (paused); the people board needs no bandwidth mode. */
  lowBandwidth?: boolean;
  onMessage?: (userId: string) => Promise<boolean>;
};

const connectionTone = { live: "primary", connecting: "neutral", error: "danger", unconfigured: "warning", simulated: "warning" } as const;
const statusOrder: Record<PresenceStatus, number> = { online: 0, busy: 1, away: 2, dnd: 3, offline: 4 };

const chip =
  "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 type-label-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface data-[state=on]:bg-primary-container data-[state=on]:font-semibold data-[state=on]:text-on-primary-action [&[data-state=on]_.count]:bg-on-primary-action/15 [&[data-state=on]_.count]:text-on-primary-action";

// Product-owner decision (2026-10-22): the office is a board of people tags (4 per row, scrolling)
// instead of the 3D floor, which returns once the commissioned 3D assets exist. Connected people
// come first; each tag has one-click message / voice / video.
export function OfficeView({ data, viewerId, presence, connection, onMessage }: Props) {
  const t = useTranslations();
  const deptLabel = useDepartmentLabel();
  const [department, setDepartment] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const occupants = useMemo(() => buildOccupants(data, presence), [data, presence]);
  const visible = useMemo(() => filterOccupants(occupants, department, query), [occupants, department, query]);
  const counts = useMemo(() => countByDepartment(occupants), [occupants]);
  const summary = useMemo(() => presenceSummary(occupants), [occupants]);
  const departments = useMemo(
    () => [...data.departments].sort((a, b) => a.sortOrder - b.sortOrder).map((d) => d.slug).filter((slug) => counts.has(slug)),
    [data.departments, counts],
  );
  const here = visible.filter((o) => o.status !== "offline").sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.displayName.localeCompare(b.displayName));
  const away = visible.filter((o) => o.status === "offline");
  const selected = occupants.find((o) => o.userId === selectedId) ?? null;
  const close = useCallback(() => setSelectedId(null), []);

  const stats = [
    { status: "online", value: summary.online },
    { status: "busy", value: summary.busy },
    { status: "dnd", value: summary.dnd },
  ] as const;

  return (
    <div className="flex gap-gutter px-margin-mobile py-space-lg lg:p-margin">
      <div className="flex min-w-0 flex-1 flex-col gap-space-md">
        <header className="glass-level-1 flex flex-wrap items-center gap-x-space-md gap-y-space-sm rounded-xl px-4 py-3">
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-container-high text-secondary">
            <Building2 className="size-5" />
          </span>
          <div className="me-auto min-w-0">
            <h1 className="truncate type-title-md text-on-surface">{data.layoutName}</h1>
            <p className="mt-0.5 truncate type-label-xs uppercase tracking-[0.08em] text-secondary">{data.orgName}</p>
          </div>
          <dl aria-label={t("office.presenceTitle")} className="flex items-center gap-1.5">
            {stats.map(({ status, value }) => (
              <div key={status} title={t(`presence.${status}`)} className="flex items-center gap-2 rounded-md border border-glass-line bg-surface-container-low/60 px-2.5 py-1.5">
                <dt className="sr-only">{t(`presence.${status}`)}</dt>
                <PresenceDot status={status} />
                <dd className="type-label-lg tabular-nums text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
          <Badge tone={connectionTone[connection]} aria-live="polite">{t(`office.connection.${connection}`)}</Badge>
          {data.orgIsDemo ? <Badge tone="warning">{t("office.demoData")}</Badge> : null}
        </header>

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
          {departments.length > 1 ? (
            <ToggleGroup.Root
              type="single"
              aria-label={t("office.filtersLabel")}
              value={department ?? "all"}
              onValueChange={(v) => v && setDepartment(v === "all" ? null : v)}
              className="glass-level-1 flex gap-space-2xs rounded-md p-space-2xs max-md:w-full max-md:overflow-x-auto max-md:[scrollbar-width:none] md:flex-wrap"
            >
              <ToggleGroup.Item value="all" className={chip}>
                {t("office.allRooms")}
                <span className="count rounded-sm bg-surface-container-high px-1.5 type-label-xs tabular-nums">{occupants.length}</span>
              </ToggleGroup.Item>
              {departments.map((slug) => (
                <ToggleGroup.Item key={slug} value={slug} className={chip}>
                  {deptLabel(slug)}
                  <span className="count rounded-sm bg-surface-container-high px-1.5 type-label-xs tabular-nums">{counts.get(slug)}</span>
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          ) : null}
          <p className="type-label-md text-on-surface-variant sm:ms-auto" aria-live="polite">{t("office.peopleCount", { count: visible.length })}</p>
        </div>

        {visible.length === 0 ? (
          <StateMessage icon={<Users />} title={t("office.noResults", { query })} className="mt-space-xl" />
        ) : (
          <>
            {here.length ? (
              <Section title={t("office.board.here", { count: here.length })} live>
                {here.map((p) => (
                  <PersonTag key={p.userId} person={p} isSelf={p.userId === viewerId} selected={p.userId === selectedId} onOpen={setSelectedId} onMessage={onMessage} />
                ))}
              </Section>
            ) : null}
            {away.length ? (
              <Section title={here.length ? t("office.board.notConnected", { count: away.length }) : t("office.board.everyone", { count: away.length })}>
                {away.map((p) => (
                  <PersonTag key={p.userId} person={p} isSelf={p.userId === viewerId} selected={p.userId === selectedId} onOpen={setSelectedId} onMessage={onMessage} />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </div>

      {selected ? (
        // Desktop: sticky side column. Phones/tablets: a bottom sheet.
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

function Section({ title, live = false, children }: { title: string; live?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-space-sm">
      <h2 className="flex items-center gap-2 type-label-xs uppercase tracking-[0.08em] text-on-surface-variant">
        {live ? <span aria-hidden className="size-2 rounded-full bg-presence-online motion-safe:animate-pulse" /> : null}
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-gutter md:grid-cols-3 xl:grid-cols-4">{children}</ul>
    </section>
  );
}

const COVER_COUNT = 16;

/** A stable cover for each person, picked from their id (same cover on every device). */
export function coverFor(userId: string) {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `/covers/cover-${String((hash % COVER_COUNT) + 1).padStart(2, "0")}.svg`;
}

type TagProps = { person: Occupant; isSelf: boolean; selected: boolean; onOpen: (userId: string) => void; onMessage?: (userId: string) => Promise<boolean> };

/** A person's name tag on the office board: open the profile, or message / call in one click. */
function PersonTag({ person, isSelf, selected, onOpen, onMessage }: TagProps) {
  const t = useTranslations();
  const deptLabel = useDepartmentLabel();
  const calls = useCallActions();
  const offline = person.status === "offline";

  return (
    <li
      className={cn(
        "glass-level-2 group relative flex flex-col items-center gap-3 overflow-hidden rounded-xl px-3 pb-3 text-center transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-surface-glass-highlight motion-reduce:hover:translate-y-0",
        selected && "border-primary-container",
      )}
    >
      {/* Abstract cover art (scripts/build-covers.mjs), fixed per person; muted while offline. */}
      <span
        aria-hidden
        className={cn("-mx-3 block h-20 self-stretch bg-cover bg-center transition-[filter,opacity] duration-200", offline && "opacity-60 saturate-50")}
        style={{ backgroundImage: `url(${coverFor(person.userId)})` }}
      />
      {/* The whole tag opens the profile; the action buttons sit above this layer. */}
      <button
        type="button"
        onClick={() => onOpen(person.userId)}
        aria-current={selected ? "true" : undefined}
        aria-label={`${person.displayName}, ${t(`presence.${person.status}`)}`}
        className="absolute inset-0 rounded-xl focus-visible:shadow-focus-ring focus-visible:outline-none"
      />
      {/* Frame in the card's own fill so the avatar reads as cut out of the cover. */}
      <span className="relative -mt-11 rounded-[1.25rem] p-1 shadow-level-2" style={{ backgroundColor: "var(--tv-glass-level-2-fill)" }}>
        <Avatar
          name={person.displayName}
          src={person.avatarUrl}
          size="lg"
          status={person.status}
          statusLabel={t(`presence.${person.status}`)}
          decorative
        />
      </span>
      <div className="w-full min-w-0">
        <p className="truncate type-title-md text-on-surface">
          {person.displayName}
          {isSelf ? <span className="type-body-sm text-on-surface-variant"> ({t("calls.you")})</span> : null}
        </p>
        <p className="mt-0.5 truncate type-body-sm text-on-surface-variant">{person.title ?? (person.departmentSlug ? deptLabel(person.departmentSlug) : "")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-2 py-0.5 type-label-md text-on-surface-variant">
          <PresenceDot status={person.status} />
          {t(`presence.${person.status}`)}
        </span>
        {person.title && person.departmentSlug ? <Badge tone={departmentTone(person.departmentSlug)}>{deptLabel(person.departmentSlug)}</Badge> : null}
      </div>

      {!isSelf ? (
        <div className="relative z-10 mt-auto grid w-full grid-cols-3 gap-1.5 border-t border-glass-line pt-3">
          <TagAction label={t("office.profile.message")} disabled={!onMessage} onClick={() => void onMessage?.(person.userId)}>
            <MessageSquare />
          </TagAction>
          <TagAction label={t("office.profile.voiceCall")} reason={calls.ready ? calls.blocked : t("office.profile.previewHint")} onClick={() => calls.startCall(person.userId, "audio")}>
            <Phone />
          </TagAction>
          <TagAction label={t("office.profile.videoCall")} reason={calls.ready ? calls.blocked : t("office.profile.previewHint")} onClick={() => calls.startCall(person.userId, "video")}>
            <Video />
          </TagAction>
        </div>
      ) : (
        <p className="relative z-10 mt-auto w-full border-t border-glass-line pt-3 type-label-md text-on-surface-variant">{t("office.board.thisIsYou")}</p>
      )}
    </li>
  );
}

function TagAction({ label, onClick, disabled = false, reason = null, children }: { label: string; onClick: () => void; disabled?: boolean; reason?: string | null; children: ReactNode }) {
  const blocked = disabled || Boolean(reason);
  return (
    <button
      type="button"
      onClick={blocked ? undefined : onClick}
      aria-disabled={blocked || undefined}
      aria-label={reason ? `${label} — ${reason}` : label}
      title={reason ?? label}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md text-on-surface-variant transition-colors focus-visible:shadow-focus-ring focus-visible:outline-none [&_svg]:size-4.5",
        blocked ? "cursor-not-allowed opacity-40" : "hover:bg-primary-container/15 hover:text-primary",
      )}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
