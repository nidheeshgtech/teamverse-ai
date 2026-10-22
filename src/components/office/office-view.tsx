"use client";

import { Building2, CornerDownLeft, LayoutGrid, List, MessageSquare, Phone, Search, TextSearch, Users, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

type PeopleView = "grid" | "list" | "search";
const VIEW_KEY = "tv.office.people-view";

function readView(): PeopleView | null {
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "grid" || v === "list" || v === "search" ? v : null;
  } catch {
    return null;
  }
}
function writeView(view: PeopleView) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage unavailable (private mode): the choice simply isn't remembered.
  }
}

const viewChip =
  "inline-flex h-9 items-center gap-2 rounded-md px-3 type-label-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface data-[state=on]:bg-surface-container-highest data-[state=on]:text-on-surface [&_svg]:size-4.5";

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
  const [view, setViewState] = useState<PeopleView>("grid");

  useEffect(() => {
    const stored = readView();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
    if (stored) setViewState(stored);
  }, []);
  const setView = (next: PeopleView) => {
    setViewState(next);
    writeView(next);
  };

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
          {view !== "search" ? (
            <InputWithIcon
              icon={<Search />}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("office.searchPeople")}
              aria-label={t("office.searchPeople")}
              className="w-full sm:w-80"
            />
          ) : null}
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
          <div className="flex items-center gap-space-sm max-sm:w-full sm:ms-auto">
            {view !== "search" ? (
              <p className="type-label-md text-on-surface-variant max-sm:me-auto" aria-live="polite">{t("office.peopleCount", { count: visible.length })}</p>
            ) : null}
            <ToggleGroup.Root
              type="single"
              aria-label={t("office.views.label")}
              value={view}
              onValueChange={(v) => v && setView(v as PeopleView)}
              className="glass-level-1 flex gap-space-2xs rounded-md p-space-2xs"
            >
              <ToggleGroup.Item value="grid" className={viewChip} aria-label={t("office.views.grid")}>
                <LayoutGrid aria-hidden />
                <span className="max-md:hidden">{t("office.views.grid")}</span>
              </ToggleGroup.Item>
              <ToggleGroup.Item value="list" className={viewChip} aria-label={t("office.views.list")}>
                <List aria-hidden />
                <span className="max-md:hidden">{t("office.views.list")}</span>
              </ToggleGroup.Item>
              <ToggleGroup.Item value="search" className={viewChip} aria-label={t("office.views.search")}>
                <TextSearch aria-hidden />
                <span className="max-md:hidden">{t("office.views.search")}</span>
              </ToggleGroup.Item>
            </ToggleGroup.Root>
          </div>
        </div>

        {view === "search" ? (
          <PeopleFinder
            people={filterOccupants(occupants, department, "")}
            online={summary.online + summary.busy + summary.away + summary.dnd}
            viewerId={viewerId}
            onOpen={setSelectedId}
            onMessage={onMessage}
          />
        ) : visible.length === 0 ? (
          <StateMessage icon={<Users />} title={t("office.noResults", { query })} className="mt-space-xl" />
        ) : (
          <>
            {here.length ? (
              <Section title={t("office.board.here", { count: here.length })} live layout={view}>
                {here.map((p) => <Person key={p.userId} view={view} person={p} isSelf={p.userId === viewerId} selected={p.userId === selectedId} onOpen={setSelectedId} onMessage={onMessage} />)}
              </Section>
            ) : null}
            {away.length ? (
              <Section title={here.length ? t("office.board.notConnected", { count: away.length }) : t("office.board.everyone", { count: away.length })} layout={view}>
                {away.map((p) => <Person key={p.userId} view={view} person={p} isSelf={p.userId === viewerId} selected={p.userId === selectedId} onOpen={setSelectedId} onMessage={onMessage} />)}
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

function Section({ title, live = false, layout, children }: { title: string; live?: boolean; layout: "grid" | "list"; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-space-sm">
      <h2 className="flex items-center gap-2 type-label-xs uppercase tracking-[0.08em] text-on-surface-variant">
        {live ? <span aria-hidden className="size-2 rounded-full bg-presence-online motion-safe:animate-pulse" /> : null}
        {title}
      </h2>
      {layout === "grid" ? (
        <ul className="grid grid-cols-2 gap-gutter md:grid-cols-3 xl:grid-cols-4">{children}</ul>
      ) : (
        <ul className="glass-level-2 divide-y divide-glass-line overflow-hidden rounded-xl">{children}</ul>
      )}
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
        <QuickActions person={person} onMessage={onMessage} className="relative z-10 mt-auto grid w-full grid-cols-3 gap-1.5 border-t border-glass-line pt-3" />
      ) : (
        <p className="relative z-10 mt-auto w-full border-t border-glass-line pt-3 type-label-md text-on-surface-variant">{t("office.board.thisIsYou")}</p>
      )}
    </li>
  );
}

function Person(props: TagProps & { view: "grid" | "list" }) {
  return props.view === "grid" ? <PersonTag {...props} /> : <PersonRow {...props} />;
}

/** One compact row: cover accent, avatar, name and title, department, status, quick actions. */
function PersonRow({ person, isSelf, selected, onOpen, onMessage, active = false, id }: TagProps & { active?: boolean; id?: string }) {
  const t = useTranslations();
  const deptLabel = useDepartmentLabel();
  const offline = person.status === "offline";
  return (
    <li
      id={id}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 transition-colors sm:gap-4 sm:px-4",
        "hover:bg-surface-container-low",
        (selected || active) && "bg-surface-container-low",
        active && "shadow-[inset_3px_0_0_var(--tv-color-primary-container)]",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(person.userId)}
        aria-current={selected ? "true" : undefined}
        aria-label={`${person.displayName}, ${t(`presence.${person.status}`)}`}
        className="absolute inset-0 focus-visible:shadow-focus-ring focus-visible:outline-none"
      />
      <span
        aria-hidden
        className={cn("h-11 w-1.5 shrink-0 rounded-full bg-cover bg-center", offline && "opacity-50 saturate-50")}
        style={{ backgroundImage: `url(${coverFor(person.userId)})` }}
      />
      <Avatar name={person.displayName} src={person.avatarUrl} size="md" status={person.status} statusLabel={t(`presence.${person.status}`)} decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate type-label-lg font-semibold text-on-surface">
          {person.displayName}
          {isSelf ? <span className="font-normal text-on-surface-variant"> ({t("calls.you")})</span> : null}
        </span>
        <span className="block truncate type-body-sm text-on-surface-variant">{person.title ?? (person.departmentSlug ? deptLabel(person.departmentSlug) : "")}</span>
      </span>
      {person.title && person.departmentSlug ? (
        <Badge tone={departmentTone(person.departmentSlug)} className="max-lg:hidden">{deptLabel(person.departmentSlug)}</Badge>
      ) : null}
      <span className="inline-flex w-36 shrink-0 items-center gap-1.5 type-label-md text-on-surface-variant max-md:hidden">
        <PresenceDot status={person.status} />
        {t(`presence.${person.status}`)}
      </span>
      {!isSelf ? <QuickActions person={person} onMessage={onMessage} className="relative z-10 flex shrink-0 gap-0.5 [&>button]:w-9" /> : <span className="w-[6.9rem] shrink-0 max-sm:hidden" />}
    </li>
  );
}

function QuickActions({ person, onMessage, className }: { person: Occupant; onMessage?: (userId: string) => Promise<boolean>; className: string }) {
  const t = useTranslations();
  const calls = useCallActions();
  const reason = calls.ready ? calls.blocked : t("office.profile.previewHint");
  return (
    <div className={className}>
      <TagAction label={t("office.profile.message")} disabled={!onMessage} onClick={() => void onMessage?.(person.userId)}>
        <MessageSquare />
      </TagAction>
      <TagAction label={t("office.profile.voiceCall")} reason={reason} onClick={() => calls.startCall(person.userId, "audio")}>
        <Phone />
      </TagAction>
      <TagAction label={t("office.profile.videoCall")} reason={reason} onClick={() => calls.startCall(person.userId, "video")}>
        <Video />
      </TagAction>
    </div>
  );
}

type FinderProps = { people: Occupant[]; online: number; viewerId: string; onOpen: (userId: string) => void; onMessage?: (userId: string) => Promise<boolean> };

/** Spotlight-style finder: one big search box, results as you type, arrow keys + Enter. */
function PeopleFinder({ people, online, viewerId, onOpen, onMessage }: FinderProps) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return [];
    // Names that start with the query rank above matches elsewhere.
    return filterOccupants(people, null, q).sort(
      (a, b) =>
        Number(!a.displayName.toLocaleLowerCase().startsWith(q)) - Number(!b.displayName.toLocaleLowerCase().startsWith(q)) ||
        statusOrder[a.status] - statusOrder[b.status] ||
        a.displayName.localeCompare(b.displayName),
    );
  }, [people, query]);
  const here = useMemo(() => people.filter((p) => p.status !== "offline"), [people]);
  const current = Math.min(active, Math.max(0, results.length - 1));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (current + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      setActive(next);
      document.getElementById(`finder-${results[next].userId}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      onOpen(results[current].userId);
    }
  };

  return (
    <section aria-labelledby="finder-title" className="flex flex-col gap-space-lg">
      <div className="relative overflow-hidden rounded-xl border border-glass-line px-5 py-10 sm:px-10 sm:py-14">
        {/* Decorative backdrop from the same cover art as the tags. */}
        <span aria-hidden className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: "url(/covers/cover-01.svg)" }} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-surface-canvas/40 to-surface-canvas/90" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-space-md text-center">
          <h2 id="finder-title" className="type-headline-lg text-on-surface">{t("office.finder.title")}</h2>
          <p className="type-body-md text-on-surface-variant">{t("office.finder.subtitle", { count: people.length, online })}</p>
          <label className="group relative mt-space-xs flex h-16 w-full items-center gap-3 rounded-lg border border-glass-line bg-surface-canvas/85 px-5 shadow-level-3 backdrop-blur-xl transition-[border-color,box-shadow] focus-within:border-primary-container focus-within:shadow-glow-primary">
            <Search aria-hidden className="size-6 shrink-0 text-on-surface-variant group-focus-within:text-primary" />
            <span className="sr-only">{t("office.searchPeople")}</span>
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={t("office.finder.placeholder")}
              autoComplete="off"
              aria-describedby="finder-hint"
              className="h-full min-w-0 flex-1 bg-transparent type-title-md text-on-surface outline-none placeholder:text-on-surface-variant/70 sm:text-xl [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); input.current?.focus(); }} className="rounded-md px-2 py-1 type-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
                {t("office.finder.clear")}
              </button>
            ) : null}
          </label>
          <p id="finder-hint" className="flex items-center gap-2 type-label-md text-on-surface-variant max-sm:hidden">
            <kbd className="rounded border border-glass-line px-1.5 py-0.5 type-code-sm">↑</kbd>
            <kbd className="rounded border border-glass-line px-1.5 py-0.5 type-code-sm">↓</kbd>
            {t("office.finder.hintMove")}
            <kbd className="ms-2 inline-flex items-center rounded border border-glass-line px-1.5 py-0.5"><CornerDownLeft className="size-3.5" /></kbd>
            {t("office.finder.hintOpen")}
          </p>
        </div>
      </div>

      {query.trim() ? (
        <div className="flex flex-col gap-space-sm">
          <p className="type-label-xs uppercase tracking-[0.08em] text-on-surface-variant" aria-live="polite">{t("office.finder.results", { count: results.length })}</p>
          {results.length ? (
            <ul className="glass-level-2 divide-y divide-glass-line overflow-hidden rounded-xl">
              {results.map((p, i) => (
                <PersonRow key={p.userId} id={`finder-${p.userId}`} person={p} isSelf={p.userId === viewerId} selected={false} active={i === current} onOpen={onOpen} onMessage={onMessage} />
              ))}
            </ul>
          ) : (
            <StateMessage icon={<Users />} title={t("office.noResults", { query: query.trim() })} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-space-sm">
          <h3 className="flex items-center gap-2 type-label-xs uppercase tracking-[0.08em] text-on-surface-variant">
            {here.length ? <span aria-hidden className="size-2 rounded-full bg-presence-online motion-safe:animate-pulse" /> : null}
            {t("office.finder.quick")}
          </h3>
          {here.length ? (
            <ul className="flex flex-wrap gap-2">
              {here.map((p) => (
                <li key={p.userId}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.userId)}
                    className="glass-level-1 inline-flex items-center gap-2 rounded-full py-1 ps-1 pe-3.5 type-label-lg text-on-surface hover:border-primary-container/50 focus-visible:shadow-focus-ring focus-visible:outline-none"
                  >
                    <Avatar name={p.displayName} src={p.avatarUrl} size="sm" status={p.status} decorative />
                    {p.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body-md text-on-surface-variant">{t("office.finder.quickNone")}</p>
          )}
        </div>
      )}
    </section>
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
