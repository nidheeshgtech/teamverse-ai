"use client";

import { Check, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/ui/dialog";
import { FieldError, Input, InputWithIcon, Label } from "@/ui/input";
import { useComms } from "./comms-context";

// DESIGN GAP: no "new message" screen in Stitch. Level-3 glass dialog with the people-list rows.
export function NewConversationDialog({ basePath, children }: { basePath: string; children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const { transport, store, people, viewerId, statusOf } = useComms();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const candidates = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return [...people.values()]
      .filter((p) => p.userId !== viewerId)
      .filter((p) => !q || p.displayName.toLocaleLowerCase().includes(q) || (p.title ?? "").toLocaleLowerCase().includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [people, query, viewerId]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const reset = () => {
    setQuery("");
    setSelected([]);
    setGroupName("");
    setError(false);
  };

  const start = async () => {
    if (!selected.length) return;
    setPending(true);
    setError(false);
    try {
      const id = await transport.createConversation(
        selected.length === 1 ? { kind: "direct", memberIds: selected } : { kind: "group", memberIds: selected, name: groupName.trim() || undefined },
      );
      await store.reload();
      setOpen(false);
      reset();
      router.push(`${basePath}/${id}`);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  const startLabel =
    selected.length === 0
      ? t("comms.newConversation.pickSomeone")
      : selected.length === 1
        ? t("comms.newConversation.start", { name: people.get(selected[0])?.displayName ?? "" })
        : t("comms.newConversation.startGroup", { count: selected.length });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={t("comms.newConversation.title")}
        description={t("comms.newConversation.description")}
        closeLabel={t("comms.thread.cancel")}
        footer={
          <Button variant="primary" disabled={!selected.length || pending} onClick={() => void start()}>
            {startLabel}
          </Button>
        }
      >
        <div className="flex flex-col gap-space-md">
          <InputWithIcon
            icon={<Search />}
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("comms.newConversation.search")}
            aria-label={t("comms.newConversation.search")}
          />
          <ul aria-label={t("comms.newConversation.search")} aria-multiselectable className="flex max-h-72 flex-col gap-space-2xs overflow-y-auto" role="listbox">
            {candidates.map((p) => {
              const isSelected = selected.includes(p.userId);
              return (
                <li
                  key={p.userId}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => toggle(p.userId)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      toggle(p.userId);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-space-sm rounded-md px-space-sm py-space-xs focus-visible:shadow-focus-ring focus-visible:outline-none",
                    isSelected ? "bg-primary-container/15" : "hover:bg-surface-container-high",
                  )}
                >
                  <Avatar name={p.displayName} src={p.avatarUrl} size="sm" status={statusOf(p.userId)} decorative />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate type-label-lg text-on-surface">{p.displayName}</span>
                    {p.title ? <span className="truncate type-body-sm text-on-surface-variant">{p.title}</span> : null}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "ms-auto inline-flex size-5 items-center justify-center rounded-sm border",
                      isSelected ? "border-primary-container bg-primary-container text-on-primary-action" : "border-outline-variant",
                    )}
                  >
                    {isSelected ? <Check className="size-3.5" /> : null}
                  </span>
                </li>
              );
            })}
            {!candidates.length ? <li className="px-space-sm type-body-sm text-on-surface-variant">{t("comms.newConversation.noPeople", { query })}</li> : null}
          </ul>
          {selected.length > 1 ? (
            <div className="flex flex-col gap-space-xs">
              <Label htmlFor="group-name">{t("comms.newConversation.groupName")}</Label>
              <Input id="group-name" maxLength={120} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
          ) : null}
          <p className="type-label-md text-on-surface-variant" aria-live="polite">
            {t("comms.newConversation.selected", { count: selected.length })}
          </p>
          {error ? <FieldError>{t("comms.newConversation.failed")}</FieldError> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
