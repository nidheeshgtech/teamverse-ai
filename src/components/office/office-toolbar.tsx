"use client";

import { Box, Gauge, LayoutGrid, LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { ToggleGroup, Toggle } from "radix-ui";
import { cn } from "@/lib/utils";
import { Hint } from "@/ui/menu";
import { useDepartmentLabel } from "./use-labels";

export type OfficeViewMode = "3d" | "2d";

type Props = {
  departments: string[];
  counts: Map<string, number>;
  total: number;
  department: string | null;
  onDepartment: (slug: string | null) => void;
  view: OfficeViewMode;
  onView: (view: OfficeViewMode) => void;
  webgl: boolean;
  performance: boolean;
  onPerformance: (on: boolean) => void;
  onRecenter: () => void;
};

const chip =
  "inline-flex h-8 shrink-0 items-center gap-space-xs whitespace-nowrap rounded px-space-sm type-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface data-[state=on]:bg-primary-container data-[state=on]:font-semibold data-[state=on]:text-on-primary-action";

export function OfficeToolbar(props: Props) {
  const t = useTranslations("office");
  const deptLabel = useDepartmentLabel();

  return (
    // Phones: the room chips scroll sideways in one row instead of wrapping into a tall block.
    <div className="flex flex-wrap items-center justify-between gap-space-sm">
      <ToggleGroup.Root
        type="single"
        aria-label={t("filtersLabel")}
        value={props.department ?? "all"}
        onValueChange={(value) => value && props.onDepartment(value === "all" ? null : value)}
        className="glass-level-1 flex items-center gap-space-2xs rounded-md p-space-2xs max-md:w-full max-md:overflow-x-auto max-md:[scrollbar-width:none] md:flex-wrap"
      >
        <ToggleGroup.Item value="all" className={chip}>
          {t("allRooms")} <Count value={props.total} />
        </ToggleGroup.Item>
        {props.departments.map((slug) => (
          <ToggleGroup.Item key={slug} value={slug} className={chip}>
            {deptLabel(slug)} <Count value={props.counts.get(slug) ?? 0} />
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <div className="glass-level-1 flex items-center gap-space-2xs rounded-md p-space-2xs">
        <ToggleGroup.Root
          type="single"
          aria-label={t("viewLabel")}
          value={props.view}
          onValueChange={(value) => value && props.onView(value as OfficeViewMode)}
          className="flex items-center gap-space-2xs"
        >
          <ToggleGroup.Item value="3d" disabled={!props.webgl} className={cn(chip, "disabled:opacity-40")}>
            <Box aria-hidden className="size-4" /> {t("view3d")}
          </ToggleGroup.Item>
          <ToggleGroup.Item value="2d" className={chip}>
            <LayoutGrid aria-hidden className="size-4" /> {t("view2d")}
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        {props.view === "3d" ? (
          <>
            <Hint label={t("recenter")}>
              <button type="button" aria-label={t("recenter")} onClick={props.onRecenter} className={chip}>
                <LocateFixed aria-hidden className="size-4" />
              </button>
            </Hint>
            <Hint label={t("performanceHint")}>
              <Toggle.Root pressed={props.performance} onPressedChange={props.onPerformance} aria-label={t("performanceMode")} className={chip}>
                <Gauge aria-hidden className="size-4" />
              </Toggle.Root>
            </Hint>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Count({ value }: { value: number }) {
  return <span className="type-code-sm opacity-80">{value}</span>;
}
