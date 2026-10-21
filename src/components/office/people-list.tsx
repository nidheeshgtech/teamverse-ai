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
      <div className="flex items-center justify-between px-5 pt-5">
        <PanelEyebrow id="people-title">{t("office.peopleTitle")}</PanelEyebrow>
        <span className="type-label-md text-on-surface-variant" aria-live="polite">
          {t("office.peopleCount", { count: people.length })}
        </span>
      </div>
      <div className="px-5 pt-3 pb-2">
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
        <p className="px-5 pb-5 type-body-md text-on-surface-variant">{t("office.noResults", { query })}</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-3">
          {people.map((person) => (
            <li key={person.userId}>
              <button
                type="button"
                onClick={() => onSelect(person.userId)}
                aria-current={person.userId === selectedId ? "true" : undefined}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-start transition-colors duration-150 hover:bg-surface-container-high/70 focus-visible:shadow-focus-ring focus-visible:outline-none aria-[current=true]:bg-primary-container/10 aria-[current=true]:ring-1 aria-[current=true]:ring-primary-container/40"
              >
                <Avatar name={person.displayName} src={person.avatarUrl} size="md" status={person.status} statusLabel={t(`presence.${person.status}`)} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-label-lg text-on-surface">{person.displayName}</span>
                  <span className="mt-0.5 block truncate type-body-sm text-on-surface-variant">
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
