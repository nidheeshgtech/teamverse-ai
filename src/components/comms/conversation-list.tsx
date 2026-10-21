"use client";

import { ChevronDown, Hash, Lock, MessageSquarePlus, Plus, Search, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { toPlainText } from "@/features/messaging/markdown";
import type { ConversationSummary } from "@/features/messaging/model";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { InputWithIcon } from "@/ui/input";
import { Skeleton, StateMessage } from "@/ui/states";
import { ChannelsDialog } from "./channels-dialog";
import { useComms } from "./comms-context";
import { NewConversationDialog } from "./new-conversation-dialog";

// Stitch Communications › middle column ("Dubai Agency HQ" card, CHANNELS, DIRECT TELEMETRY).
// DESIGN DEVIATIONS: "Direct Telemetry" → "Direct messages"; per-person activity lines ("Active on
// Figma Mirror", "Focus Mode: Deploying v4") → last message preview (no activity tracking); "VIP"
// tag and "Spatial Mesh L3 · Latency 18ms" footer omitted (no data source).
export function ConversationList({ basePath }: { basePath: string }) {
  const t = useTranslations("comms");
  const { inbox, store, orgName, conversationName } = useComms();
  const params = useParams<{ conversationId?: string }>();
  const activeId = params.conversationId ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({ channels: true, direct: true });

  const { channels, direct } = useMemo(() => {
    const list = inbox.conversations ?? [];
    const q = query.trim().toLocaleLowerCase();
    const match = (c: ConversationSummary) => !q || conversationName({ ...c, memberIds: c.member_ids }).toLocaleLowerCase().includes(q);
    return {
      channels: list.filter((c) => c.kind === "channel" && match(c)),
      direct: list.filter((c) => c.kind !== "channel" && match(c)),
    };
  }, [inbox.conversations, query, conversationName]);

  return (
    <nav aria-label={t("listLabel")} className="flex min-h-0 flex-col gap-space-md border-e border-glass-line bg-surface-panel/60 p-space-md">
      <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low/70 p-space-sm">
        <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-md bg-surface-container-high text-secondary [&_svg]:size-5">
          <Users />
        </span>
        <div className="min-w-0">
          <p className="truncate type-title-md text-on-surface">{orgName}</p>
          {store.transport.mode === "demo" ? <Badge tone="warning">{t("demoData")}</Badge> : null}
        </div>
      </div>

      <InputWithIcon
        icon={<Search />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("filterPlaceholder")}
        aria-label={t("filterPlaceholder")}
        type="search"
      />

      <div className="-mx-space-xs flex min-h-0 flex-1 flex-col gap-space-md overflow-y-auto px-space-xs">
        {inbox.conversations === null && !inbox.error ? (
          <ListSkeleton />
        ) : inbox.error && !inbox.conversations ? (
          <StateMessage
            tone="error"
            title={t("listFailed")}
            action={
              <Button size="sm" onClick={() => void store.reload()}>
                {t("retry")}
              </Button>
            }
          />
        ) : (
          <>
            <Section
              id="channels"
              title={t("channelsSection", { count: channels.length })}
              open={open.channels}
              onToggle={() => setOpen((o) => ({ ...o, channels: !o.channels }))}
              action={
                <ChannelsDialog basePath={basePath}>
                  <IconAction label={t("channelActions")}>
                    <Plus />
                  </IconAction>
                </ChannelsDialog>
              }
            >
              {channels.map((c) => (
                <ChannelRow key={c.id} conversation={c} active={c.id === activeId} href={`${basePath}/${c.id}`} />
              ))}
            </Section>

            <Section
              id="direct"
              title={t("directSection", { count: direct.length })}
              open={open.direct}
              onToggle={() => setOpen((o) => ({ ...o, direct: !o.direct }))}
              action={
                <NewConversationDialog basePath={basePath}>
                  <IconAction label={t("newMessage")}>
                    <MessageSquarePlus />
                  </IconAction>
                </NewConversationDialog>
              }
            >
              {direct.map((c) => (
                <DirectRow key={c.id} conversation={c} active={c.id === activeId} href={`${basePath}/${c.id}`} />
              ))}
            </Section>

            {query && !channels.length && !direct.length ? (
              <p role="status" className="px-space-sm type-body-sm text-on-surface-variant">
                {t("noMatches", { query })}
              </p>
            ) : null}
            {!query && inbox.conversations?.length === 0 ? (
              <StateMessage title={t("noConversations")} description={t("noConversationsHint")} />
            ) : null}
          </>
        )}
      </div>
    </nav>
  );
}

function Section({ id, title, open, onToggle, action, children }: { id: string; title: string; open: boolean; onToggle: () => void; action: React.ReactNode; children: React.ReactNode }) {
  const t = useTranslations("comms");
  return (
    <section aria-labelledby={`section-${id}`} className="flex flex-col gap-space-2xs">
      <div className="flex items-center justify-between ps-space-2xs">
        <h2 id={`section-${id}`}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={`list-${id}`}
            aria-label={open ? t("collapse", { section: title }) : t("expand", { section: title })}
            className="flex items-center gap-space-xs rounded-sm type-label-xs uppercase text-on-surface-variant hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-200", !open && "-rotate-90 rtl:rotate-90")} />
            {title}
          </button>
        </h2>
        {action}
      </div>
      <ul id={`list-${id}`} hidden={!open} className="flex flex-col gap-space-2xs">
        {children}
      </ul>
    </section>
  );
}

function IconAction({ label, children, ...props }: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex size-7 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none [&_svg]:size-4"
      {...props}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

function UnreadCount({ count }: { count: number }) {
  const t = useTranslations("comms");
  if (count <= 0) return null;
  return (
    <span className="ms-auto inline-flex min-w-6 items-center justify-center rounded-full bg-primary-container px-space-xs type-label-xs text-on-primary-action">
      <span aria-hidden>{count > 99 ? t("unreadMore") : count}</span>
      <span className="sr-only">{t("unread", { count })}</span>
    </span>
  );
}

const rowClass = (active: boolean, unread: boolean) =>
  cn(
    "flex w-full items-center gap-space-sm rounded-md px-space-sm py-space-xs transition-[background-color,color] duration-200 focus-visible:shadow-focus-ring focus-visible:outline-none",
    active ? "bg-primary-container text-on-primary-action shadow-nav-active" : "hover:bg-surface-container-high",
    !active && (unread ? "text-on-surface" : "text-on-surface-variant"),
  );

function ChannelRow({ conversation, active, href }: { conversation: ConversationSummary; active: boolean; href: string }) {
  const unread = conversation.unread_count > 0;
  const Icon = conversation.visibility === "private" ? Lock : Hash;
  return (
    <li>
      <Link href={href} aria-current={active ? "page" : undefined} className={rowClass(active, unread)}>
        <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-on-primary-action" : "text-outline")} />
        <span className={cn("truncate type-label-lg", unread && "font-semibold")}>{conversation.name}</span>
        <UnreadCount count={active ? 0 : conversation.unread_count} />
      </Link>
    </li>
  );
}

function DirectRow({ conversation, active, href }: { conversation: ConversationSummary; active: boolean; href: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const { viewerId, people, conversationName, statusOf, timezone } = useComms();
  const name = conversationName({ ...conversation, memberIds: conversation.member_ids });
  const other = conversation.kind === "direct" ? conversation.member_ids[0] : null;
  const person = other ? people.get(other) : undefined;
  const last = conversation.last_message;
  const unread = conversation.unread_count > 0;

  const preview = !last
    ? t("comms.emptyPreview")
    : last.deleted
      ? t("comms.deletedPreview")
      : (() => {
          const text = toPlainText(last.body) || t("comms.filePreview");
          return last.sender_id === viewerId ? t("comms.youPrefix", { text }) : text;
        })();

  const time = last ? relativeStamp(last.created_at, format, timezone, t("comms.thread.yesterday")) : null;

  return (
    <li>
      <Link href={href} aria-current={active ? "page" : undefined} className={cn(rowClass(active, unread), "py-space-sm")}>
        {conversation.kind === "direct" ? (
          <Avatar name={name} src={person?.avatarUrl} status={other ? statusOf(other) : undefined} statusLabel={other ? t(`presence.${statusOf(other)}`) : undefined} />
        ) : (
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-secondary [&_svg]:size-5">
            <Users />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-space-xs">
            <span className={cn("truncate type-label-lg", unread && "font-semibold")}>{name}</span>
            {time ? <span className={cn("ms-auto shrink-0 type-code-sm", active ? "text-on-primary-action/80" : "text-outline")}>{time}</span> : null}
          </span>
          <span className="flex items-center gap-space-xs">
            <span className={cn("truncate type-body-sm", active ? "text-on-primary-action/80" : "text-on-surface-variant")}>{preview}</span>
            <UnreadCount count={active ? 0 : conversation.unread_count} />
          </span>
        </span>
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-space-sm" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-space-sm px-space-sm">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-space-2xs">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** "14:42" today, "Yesterday", otherwise a short date — in the viewer's time zone. */
export function relativeStamp(iso: string, format: ReturnType<typeof useFormatter>, timeZone: string, yesterdayLabel: string): string {
  const date = new Date(iso);
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const today = new Date();
  if (day(date) === day(today)) return format.dateTime(date, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (day(date) === day(new Date(today.getTime() - 86_400_000))) return yesterdayLabel;
  return format.dateTime(date, { timeZone, day: "numeric", month: "short" });
}
