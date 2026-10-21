"use client";

import { Building2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildOccupants, countByDepartment, filterOccupants, presenceSummary, type OfficeData, type PresenceMap } from "@/features/office/model";
import type { PresenceConnection } from "@/features/presence/use-org-presence";
import { Badge, Kbd } from "@/ui/badge";
import { Skeleton, StateMessage } from "@/ui/states";
import { FloorPlan2D } from "./floor-plan-2d";
import { OfficeToolbar, type OfficeViewMode } from "./office-toolbar";
import { PeopleList } from "./people-list";
import { PresenceCard } from "./presence-card";
import { ProfileDock } from "./profile-dock";
import type { CameraCommand } from "./scene/office-scene";
import { prefersLowPower, useReducedMotion, useWebGLSupport } from "./use-device-capabilities";
import { useDepartmentLabel } from "./use-labels";
import { cn } from "@/lib/utils";
import { useSceneTokens } from "./use-scene-tokens";

// three.js + R3F load only when the 3D view is actually shown.
const OfficeScene = dynamic(() => import("./scene/office-scene"), { ssr: false, loading: () => <SceneLoading /> });

type Props = {
  data: OfficeData;
  viewerId: string;
  presence: PresenceMap;
  connection: PresenceConnection | "simulated";
  /** Low-bandwidth preference from the viewer's profile. */
  lowBandwidth?: boolean;
  onMessage?: (userId: string) => Promise<boolean>;
};

const VIEW_KEY = "tv.office.view";
// Projected labels are placed in screen space (x measured from the physical left edge), so their
// origin is physical on purpose; RTL must not flip it.
const screenOrigin = { left: 0 } as const;
const PERF_KEY = "tv.office.performance";

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode): preference simply isn't remembered.
  }
}

export function OfficeView({ data, viewerId, presence, connection, lowBandwidth = false, onMessage }: Props) {
  const t = useTranslations("office");
  const deptLabel = useDepartmentLabel();
  const webgl = useWebGLSupport();
  const reducedMotion = useReducedMotion();
  const tokens = useSceneTokens();

  const [department, setDepartment] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const labelLayer = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<OfficeViewMode>("3d");
  const [performance, setPerformanceState] = useState(false);
  const [camera, setCamera] = useState<CameraCommand | null>(null);

  // Restore per-device preferences after hydration.
  useEffect(() => {
    const storedView = readPref(VIEW_KEY);
    const storedPerf = readPref(PERF_KEY);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from browser storage */
    if (storedView === "2d" || storedView === "3d") setViewState(storedView);
    // DESIGN.md › Mobile: 3D is optional on phones; the 2D floor plan is the default there.
    else if (window.matchMedia("(max-width: 47.99rem)").matches) setViewState("2d");
    setPerformanceState(storedPerf ? storedPerf === "1" : lowBandwidth || prefersLowPower());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lowBandwidth]);

  const setView = (next: OfficeViewMode) => {
    setViewState(next);
    writePref(VIEW_KEY, next);
  };
  const setPerformance = (on: boolean) => {
    setPerformanceState(on);
    writePref(PERF_KEY, on ? "1" : "0");
  };

  const occupants = useMemo(() => buildOccupants(data, presence), [data, presence]);
  const visible = useMemo(() => filterOccupants(occupants, department, query), [occupants, department, query]);
  const counts = useMemo(() => countByDepartment(occupants), [occupants]);
  const summary = useMemo(() => presenceSummary(occupants), [occupants]);
  const selected = occupants.find((o) => o.userId === selectedId) ?? null;

  const departments = useMemo(
    () => [...data.departments].sort((a, b) => a.sortOrder - b.sortOrder).map((d) => d.slug).filter((slug) => slug !== "meeting-room" || counts.has(slug)),
    [data.departments, counts],
  );

  const effectiveView: OfficeViewMode = webgl === false ? "2d" : view;
  const show3d = effectiveView === "3d" && webgl === true && tokens !== null;

  const focus = useCallback((userId: string) => {
    const seat = occupants.find((o) => o.userId === userId)?.seat;
    if (seat) setCamera({ kind: "focus", target: { x: seat.position.x, z: seat.position.z }, nonce: Date.now() });
  }, [occupants]);

  const select = useCallback((userId: string | null) => setSelectedId(userId), []);
  const close = useCallback(() => setSelectedId(null), []);

  if (data.scene.rooms.length === 0) {
    return <StateMessage titleAs="h2" icon={<Building2 />} title={t("noLayout")} className="mt-space-2xl" />;
  }

  return (
    // DESIGN GAP (< lg): the HUD panels stack in a scrolling column; the 3D view becomes a card.
    <div className="relative flex flex-col gap-space-md py-space-md lg:block lg:h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] lg:overflow-hidden lg:py-0">
      {/* Layer 0: 3D canvas (full bleed) */}
      {show3d ? (
        <div
          data-office-canvas
          tabIndex={0}
          aria-label={t("canvasLabel")}
          role="group"
          // Starts after the people column so the fitted scene isn't hidden behind it (logical inset: flips in RTL).
          className="relative order-2 mx-margin-mobile h-[55dvh] overflow-hidden rounded-lg isolate focus-visible:outline-offset-[-4px] lg:absolute lg:inset-y-0 lg:end-0 lg:start-[calc(var(--spacing-margin)+var(--spacing-panel-sm))] lg:mx-0 lg:h-auto lg:overflow-visible lg:rounded-none"
        >
          <OfficeScene
            rooms={data.scene.rooms}
            seats={data.seats}
            occupants={occupants}
            selectedId={selectedId}
            hoveredId={hoveredId}
            departmentFilter={department}
            labelLayer={labelLayer}
            tokens={tokens}
            performance={performance}
            reducedMotion={reducedMotion}
            camera={camera}
            onSelect={select}
            onHover={setHoveredId}
          />
          {/* DOM labels positioned by the scene's LabelProjector. Hidden until first placed. */}
          <div ref={labelLayer} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {data.scene.rooms.map((room) => (
              <span
                key={room.department}
                data-anchor={`room:${room.department}`}
                data-dimmed={department !== null && department !== room.department}
                style={screenOrigin}
                className="glass-level-1 invisible absolute top-0 inline-flex items-center gap-space-xs whitespace-nowrap rounded-full px-space-sm py-space-2xs type-label-md text-on-surface transition-opacity data-[dimmed=true]:opacity-40"
              >
                <span className="inline-block size-2 rounded-full" style={{ backgroundColor: `var(--tv-color-dept-${room.department}, var(--tv-color-primary))` }} />
                {deptLabel(room.department)} · {t("roomPeople", { count: counts.get(room.department) ?? 0 })}
              </span>
            ))}
            {occupants
              .filter((o) => o.seat && (o.userId === hoveredId || o.userId === selectedId))
              .map((o) => (
                <span
                  key={o.userId}
                  data-anchor={`person:${o.userId}`}
                  style={screenOrigin}
                  className="glass-level-3 invisible absolute top-0 whitespace-nowrap rounded px-space-sm py-space-2xs type-label-md text-on-surface"
                >
                  {o.displayName}
                </span>
              ))}
          </div>
        </div>
      ) : null}

      {/* Layer 1: HUD. Containers ignore the pointer so the canvas stays draggable between panels. */}
      <div className="pointer-events-none contents lg:absolute lg:inset-0 lg:z-10 lg:flex lg:flex-col lg:gap-space-md lg:p-margin">
        <header className="pointer-events-auto flex flex-wrap items-start justify-between gap-space-md max-lg:mx-margin-mobile">
          <div className="glass-level-1 flex flex-wrap items-center gap-space-sm rounded-lg px-space-md py-space-sm max-lg:w-full">
            <Building2 aria-hidden className="size-5 text-secondary" />
            <div>
              <h1 className="type-title-md text-on-surface">{data.layoutName}</h1>
              <p className="type-label-xs uppercase text-secondary">{data.orgName}</p>
            </div>
            {data.orgIsDemo ? <Badge tone="warning">{t("demoData")}</Badge> : null}
            {data.scene.placeholder && show3d ? <Badge>{t("placeholderScene")}</Badge> : null}
          </div>
        </header>

        <div className="pointer-events-auto max-lg:mx-margin-mobile">
          <OfficeToolbar
            departments={departments}
            counts={counts}
            total={occupants.length}
            department={department}
            onDepartment={setDepartment}
            view={effectiveView}
            onView={setView}
            webgl={webgl !== false}
            performance={performance}
            onPerformance={setPerformance}
            onRecenter={() => setCamera({ kind: "recenter", nonce: Date.now() })}
          />
        </div>
        {webgl === false ? (
          <p role="status" className="pointer-events-auto type-body-sm text-tertiary max-lg:mx-margin-mobile">{t("webglUnavailable")}</p>
        ) : null}

        <div className="relative order-3 flex min-h-0 flex-col gap-gutter max-lg:mx-margin-mobile lg:flex-1 lg:flex-row">
          <div className="pointer-events-auto order-2 flex min-h-0 shrink-0 flex-col gap-gutter lg:order-none lg:w-panel-sm">
            <PresenceCard summary={summary} connection={connection} />
            <PeopleList people={visible} query={query} onQuery={setQuery} selectedId={selectedId} onSelect={select} className="lg:flex-1" />
          </div>

          <div className={cn("min-w-0 flex-1", effectiveView === "2d" ? "order-1 max-lg:h-[60dvh] max-lg:flex-none lg:order-none" : "max-lg:hidden")}>
            {effectiveView === "2d" ? (
              <div className="pointer-events-auto size-full max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:[&>*]:min-w-[44rem]">
                <FloorPlan2D rooms={data.scene.rooms} occupants={occupants} departmentFilter={department} selectedId={selectedId} onSelect={select} />
              </div>
            ) : null}
          </div>

          {selected ? (
            // Desktop: floats over the content area so the 2D plan / 3D view keep their full width.
            // Phones/tablets: a bottom sheet.
            <ProfileDock
              desktopClassName="pointer-events-auto absolute inset-y-0 end-0 w-panel-lg overflow-y-auto"
              person={selected}
              isSelf={selected.userId === viewerId}
              canFocusDesk={show3d && selected.seat !== null}
              onFocusDesk={() => focus(selected.userId)}
              onClose={close}
              onMessage={onMessage}
            />
          ) : null}
        </div>

        {show3d ? (
          <p className="glass-level-1 pointer-events-auto hidden w-fit items-center gap-space-sm rounded-md px-space-sm py-space-xs type-label-md text-on-surface-variant lg:flex">
            <Kbd>{t("keyDrag")}</Kbd> {t("hintOrbit")}
            <Kbd>{t("keyScroll")}</Kbd> {t("hintZoom")}
            <Kbd>{t("keyRightDrag")}</Kbd> {t("hintPan")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SceneLoading() {
  const t = useTranslations("office");
  return (
    <div className="flex size-full items-center justify-center" role="status">
      <Skeleton className="h-2/3 w-2/3 rounded-xl" />
      <span className="sr-only">{t("loading3d")}</span>
    </div>
  );
}
