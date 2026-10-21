"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Occupant } from "@/features/office/model";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { InputWithIcon } from "@/ui/input";
import { Panel, PanelEyebrow } from "@/ui/panel";

type Props = {
  people: Occupant[];
  query: string;
  onQuery: (query: string) => void;
  selectedId: string | null;
  onSelect: (userId: string) => void;
  className?: string;
};

/** Searchable people list — the keyboard-accessible path to everyone in the office, in 3D or 2D. */
export function PeopleList({ people, query, onQuery, selectedId, onSelect, className }: Props) {
  const t = useTranslations();

  return (
    <Panel level={2} padding="none" className={cn("flex min-h-0 flex-col", className)} aria-labelledby="people-title">
      <div className="flex items-center justify-between px-space-md pt-space-md">
        <PanelEyebrow id="people-title">{t("office.peopleTitle")}</PanelEyebrow>
        <span className="type-label-md text-on-surface-variant" aria-live="polite">
          {t("office.peopleCount", { count: people.length })}
        </span>
      </div>
      <div className="px-space-md py-space-sm">
        <InputWithIcon
          icon={<Search />}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("office.searchPeople")}
          aria-label={t("office.searchPeople")}
        />
      </div>
      {people.length === 0 ? (
        <p className="px-space-md pb-space-md type-body-md text-on-surface-variant">{t("office.noResults", { query })}</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-space-sm pb-space-sm">
          {people.map((person) => (
            <li key={person.userId}>
              <button
                type="button"
                onClick={() => onSelect(person.userId)}
                aria-current={person.userId === selectedId ? "true" : undefined}
                className="flex w-full items-center gap-space-sm rounded-md px-space-sm py-space-xs text-start hover:bg-surface-container-high aria-[current=true]:bg-surface-container-high"
              >
                <Avatar name={person.displayName} src={person.avatarUrl} size="sm" status={person.status} statusLabel={t(`presence.${person.status}`)} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-label-lg text-on-surface">{person.displayName}</span>
                  <span className="block truncate type-body-sm text-on-surface-variant">
                    {t(`presence.${person.status}`)}
                    {person.seat ? ` · ${t("office.desk", { label: person.seat.label })}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
