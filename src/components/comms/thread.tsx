"use client";

import { ArrowDown, ArrowLeft, Hash, Info, Lock, MessagesSquare, PanelRightClose, PanelRightOpen, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { attachmentPath } from "@/features/messaging/attachments";
import { TYPING_THROTTLE_MS, TYPING_TTL_MS, type ConversationDetail } from "@/features/messaging/model";
import { initialThreadState, latestConfirmedAt, readByCount, sameDay, startsGroup, threadReducer, ts, type ThreadMessage } from "@/features/messaging/thread-state";
import { ChatError } from "@/features/messaging/transport";
import { HuddleBanner, ThreadCallButtons } from "@/components/calls/thread-call-buttons";
import { Link } from "@/i18n/navigation";
import { useMediaQuery, WIDE_QUERY } from "@/lib/use-media-query";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Sheet, SheetContent } from "@/ui/sheet";
import { Skeleton, StateMessage } from "@/ui/states";
import { memberIdsOf, useComms } from "./comms-context";
import { Composer, type ComposerHandle } from "./composer";
import { ConnectionBanner } from "./connection-banner";
import { MessageItem, type Receipt } from "./message-item";
import { ThreadDetails } from "./thread-details";

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ready"; detail: ConversationDetail };

type Outgoing = { body: string; files: File[]; uploaded: Map<number, string> };

export function Thread({ conversationId }: { conversationId: string }) {
  const t = useTranslations("comms");
  const tPresence = useTranslations("presence");
  const { transport, store, viewerId, orgId, conversationName, statusOf, people, timezone, basePath } = useComms();
  // Wide screens show details inline (toggle); narrower ones open them as a sheet.
  const wide = useMediaQuery(WIDE_QUERY);
  const [detailsSheet, setDetailsSheet] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [thread, dispatch] = useReducer(threadReducer, initialThreadState([], false));
  const [watermarks, setWatermarks] = useState<Map<string, string | null>>(() => new Map());
  const [typing, setTyping] = useState<Map<string, number>>(() => new Map());
  const [showDetails, setShowDetails] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const outbox = useRef(new Map<string, Outgoing>());
  const lastTypingSent = useRef(0);
  const threadRef = useRef(thread);
  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);
  // Updated synchronously in onScroll/send; mirrors `atBottom` for callbacks.
  const atBottomRef = useRef(true);

  // ---- read marking ------------------------------------------------------------------------
  const lastMarked = useRef<number>(Number.NEGATIVE_INFINITY);
  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible" || !atBottomRef.current) return;
    const latest = latestConfirmedAt(threadRef.current);
    if (!latest || ts(latest) <= lastMarked.current) return;
    lastMarked.current = ts(latest);
    store.markReadLocally(conversationId);
    transport.markRead(conversationId, latest).catch(() => {
      lastMarked.current = Number.NEGATIVE_INFINITY;
    });
  }, [conversationId, store, transport]);

  useEffect(() => {
    store.setActive(conversationId);
    return () => store.setActive(null);
  }, [conversationId, store]);

  useEffect(() => {
    const onVisible = () => markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  // ---- initial load ------------------------------------------------------------------------
  // Members (and their shared read positions) change rarely; re-read on membership events and reconnects.
  // A public channel stays visible after leaving, but its thread (and subscription) must not.
  const applyDetail = useCallback((detail: ConversationDetail | null) => {
    if (!detail || !detail.members.some((m) => m.userId === viewerId)) return setLoad({ state: "missing" });
    setWatermarks(new Map(detail.members.map((m) => [m.userId, m.sharedReadAt])));
    setLoad({ state: "ready", detail });
  }, [viewerId]);

  const reloadDetail = useCallback(() => {
    transport.getConversation(conversationId).then(applyDetail, () => {});
  }, [applyDetail, conversationId, transport]);

  useEffect(() => {
    let cancelled = false;
    lastMarked.current = Number.NEGATIVE_INFINITY;
    Promise.all([transport.getConversation(conversationId), transport.loadMessages(conversationId)]).then(
      ([detail, page]) => {
        if (cancelled) return;
        if (detail) dispatch({ type: "reset", messages: page.messages, hasOlder: page.hasOlder });
        applyDetail(detail);
      },
      (error) => !cancelled && setLoad({ state: error instanceof ChatError && error.code === "forbidden" ? "missing" : "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [applyDetail, conversationId, transport, attempt]);

  const ready = load.state === "ready";

  // ---- realtime ------------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const unsubscribe = transport.subscribeConversation(conversationId, {
      onMessage: (message) => {
        dispatch({ type: "received", message });
        store.noteMessage(conversationId, {
          id: message.id,
          sender_id: message.sender_id,
          kind: message.kind,
          body: message.body.slice(0, 140),
          deleted: false,
          created_at: message.created_at,
        });
        if (message.sender_id !== viewerId) {
          setTyping((m) => {
            if (!message.sender_id || !m.has(message.sender_id)) return m;
            const next = new Map(m);
            next.delete(message.sender_id);
            return next;
          });
          if (!atBottomRef.current) setUnseen((n) => n + 1);
        }
      },
      onUpdate: (update) => dispatch({ type: "updated", update }),
      onRead: (userId, readAt) => setWatermarks((m) => new Map(m).set(userId, readAt)),
      onMembersChanged: reloadDetail,
      onTyping: (userId) => setTyping((m) => new Map(m).set(userId, Date.now() + TYPING_TTL_MS)),
      onStatus: (status, resumed) => {
        if (status !== "live" || !resumed) return;
        // Back online: fetch what we missed, and fresh receipts.
        const since = latestConfirmedAt(threadRef.current);
        if (since) transport.loadSince(conversationId, since).then((messages) => dispatch({ type: "merge", messages }), () => {});
        reloadDetail();
      },
    });
    return unsubscribe;
  }, [conversationId, reloadDetail, ready, store, transport, viewerId]);

  // Expire typing indicators.
  useEffect(() => {
    if (!typing.size) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTyping((m) => {
        const next = new Map([...m].filter(([, until]) => until > now));
        return next.size === m.size ? m : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [typing.size]);

  // ---- scrolling -----------------------------------------------------------------------------
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    setUnseen(0);
  }, []);

  const messageCount = thread.messages.length;
  const newest = thread.messages.at(-1);
  const prevHeight = useRef<number | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      // Older page was prepended: keep the reader's position.
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }
    if (atBottomRef.current || newest?.sender_id === viewerId) scrollToBottom();
    markRead();
  }, [messageCount, newest?.id, newest?.sender_id, viewerId, scrollToBottom, markRead]);

  useEffect(() => {
    if (ready) requestAnimationFrame(() => scrollToBottom());
  }, [ready, scrollToBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (bottom !== atBottomRef.current) {
      atBottomRef.current = bottom;
      setAtBottom(bottom);
      if (bottom) {
        setUnseen(0);
        markRead();
      }
    }
    if (el.scrollTop < 200) void loadOlder();
  };

  const loadOlder = async () => {
    const current = threadRef.current;
    if (!current.hasOlder || current.loadingOlder) return;
    const oldest = current.messages.find((m) => m.status === "sent");
    if (!oldest) return;
    dispatch({ type: "older/start" });
    try {
      const page = await transport.loadMessages(conversationId, oldest.created_at);
      prevHeight.current = scroller.current?.scrollHeight ?? null;
      dispatch({ type: "older/done", messages: page.messages, hasOlder: page.hasOlder });
    } catch {
      dispatch({ type: "older/failed" });
    }
  };

  // ---- sending -------------------------------------------------------------------------------
  const deliver = useCallback(
    async (clientId: string) => {
      const job = outbox.current.get(clientId);
      if (!job) return;
      try {
        const attachments = [];
        for (const [index, file] of job.files.entries()) {
          let path = job.uploaded.get(index);
          if (!path) {
            path = attachmentPath(orgId, conversationId, file.name);
            await transport.uploadAttachment(path, file);
            job.uploaded.set(index, path);
          }
          attachments.push({ storage_path: path, file_name: file.name });
        }
        const message = await transport.sendMessage({ conversationId, clientId, body: job.body, attachments });
        outbox.current.delete(clientId);
        dispatch({ type: "received", message });
        store.noteMessage(conversationId, { id: message.id, sender_id: viewerId, kind: message.kind, body: message.body.slice(0, 140), deleted: false, created_at: message.created_at });
      } catch (error) {
        dispatch({ type: "send/failed", clientId, error: error instanceof Error ? error.message : "failed" });
      }
    },
    [conversationId, orgId, store, transport, viewerId],
  );

  const send = useCallback(
    ({ body, files }: { body: string; files: File[] }) => {
      const clientId = crypto.randomUUID();
      outbox.current.set(clientId, { body, files, uploaded: new Map() });
      dispatch({
        type: "send/start",
        message: {
          id: clientId,
          client_id: clientId,
          conversation_id: conversationId,
          sender_id: viewerId,
          body,
          kind: files.length ? "file" : "text",
          reply_to_id: null,
          edited_at: null,
          deleted_at: null,
          created_at: new Date().toISOString(),
          attachments: [],
          pendingFiles: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
          status: "sending",
        },
      });
      atBottomRef.current = true;
      setAtBottom(true);
      if (navigator.onLine) void deliver(clientId);
      else dispatch({ type: "send/failed", clientId, error: "offline" });
    },
    [conversationId, deliver, viewerId],
  );

  const retry = useCallback(
    (clientId: string) => {
      dispatch({ type: "send/retry", clientId });
      void deliver(clientId);
    },
    [deliver],
  );

  const discard = useCallback((clientId: string) => {
    outbox.current.delete(clientId);
    dispatch({ type: "discard", clientId });
  }, []);

  // Messages that failed while offline go out automatically when the connection returns.
  useEffect(() => {
    const onOnline = () => {
      for (const m of threadRef.current.messages) if (m.status === "failed" && m.client_id && outbox.current.has(m.client_id)) retry(m.client_id);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retry]);

  const edit = useCallback((id: string, body: string) => transport.editMessage(id, body), [transport]);
  const remove = useCallback((message: ThreadMessage) => transport.deleteMessage(message), [transport]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    transport.sendTyping(conversationId);
  }, [conversationId, transport]);

  // ---- derived -------------------------------------------------------------------------------
  const lastOwnId = useMemo(() => {
    for (let i = thread.messages.length - 1; i >= 0; i--) {
      const m = thread.messages[i];
      if (m.sender_id === viewerId && m.status === "sent" && !m.deleted_at) return m.id;
    }
    return null;
  }, [thread.messages, viewerId]);

  if (load.state === "loading") return <ThreadSkeleton />;
  if (load.state === "missing")
    return <StateMessage titleAs="h1" icon={<MessagesSquare />} title={t("thread.notFound")} description={t("thread.notFoundHint")} className="mt-space-2xl" />;
  if (load.state === "error")
    return (
      <StateMessage
        titleAs="h1"
        tone="error"
        title={t("thread.loadFailed")}
        action={
          <Button
            onClick={() => {
              setLoad({ state: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            {t("retry")}
          </Button>
        }
        className="mt-space-2xl"
      />
    );

  const { detail } = load;
  const memberIds = memberIdsOf(detail);
  const name = conversationName({ kind: detail.kind, name: detail.name, memberIds });
  const other = detail.kind === "direct" ? memberIds.find((id) => id !== viewerId) : undefined;
  const placeholder =
    detail.kind === "channel" ? t("composer.placeholderChannel", { name }) : detail.kind === "direct" ? t("composer.placeholderDirect", { name }) : t("composer.placeholderGroup");

  const receiptFor = (m: ThreadMessage): Receipt => {
    if (m.id !== lastOwnId) return null;
    if (detail.kind === "direct") {
      const readAt = other ? watermarks.get(other) : null;
      return readAt && ts(readAt) >= ts(m.created_at) ? { kind: "seen" } : { kind: "sent" };
    }
    const count = readByCount(m, watermarks);
    return count ? { kind: "readBy", count } : { kind: "sent" };
  };

  const typingNames = [...typing.keys()].filter((id) => memberIds.includes(id)).map((id) => people.get(id)?.displayName ?? "");

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section
        aria-labelledby="thread-title"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          composer.current?.addFiles([...e.dataTransfer.files]);
        }}
      >
        <header className="flex items-center gap-space-sm border-b border-glass-line px-space-sm py-space-sm max-lg:pt-[max(var(--spacing-space-sm),env(safe-area-inset-top))] sm:gap-space-md lg:px-space-lg lg:py-space-md">
          {/* Phones/tablets: back to the conversation list (the thread is full screen there). */}
          <Link
            href={basePath}
            aria-label={t("thread.back")}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none lg:hidden"
          >
            <ArrowLeft aria-hidden className="icon-directional size-5" />
          </Link>
          {detail.kind === "direct" && other ? (
            <Avatar name={name} src={people.get(other)?.avatarUrl} status={statusOf(other)} decorative />
          ) : detail.kind === "channel" ? (
            <span aria-hidden className="text-primary [&_svg]:size-6">{detail.visibility === "private" ? <Lock /> : <Hash />}</span>
          ) : (
            <span aria-hidden className="text-secondary [&_svg]:size-6"><Users /></span>
          )}
          <div className="min-w-0 flex-1">
            <h1 id="thread-title" className="truncate type-title-md text-on-surface lg:type-headline-md">{name}</h1>
            <p className="truncate type-body-sm text-on-surface-variant">
              {detail.kind === "direct" && other ? [people.get(other)?.title, tPresence(statusOf(other))].filter(Boolean).join(" · ") : null}
              {detail.kind === "channel" ? (detail.visibility === "private" ? t("thread.privateChannel") : t("thread.publicChannel")) : detail.kind === "group" ? t("thread.group") : null}
              {detail.kind !== "direct" ? ` · ${t("thread.members", { count: detail.members.length })}` : null}
              {detail.topic ? ` · ${detail.topic}` : null}
            </p>
          </div>
          <ThreadCallButtons kind={detail.kind} conversationId={detail.id} otherId={other} />
          {wide ? (
            <Button size="icon" variant="ghost" aria-pressed={showDetails} aria-label={showDetails ? t("thread.hideDetails") : t("thread.showDetails")} onClick={() => setShowDetails((s) => !s)}>
              {showDetails ? <PanelRightClose aria-hidden className="icon-directional" /> : <PanelRightOpen aria-hidden className="icon-directional" />}
            </Button>
          ) : (
            <Button size="icon" variant="ghost" aria-label={t("thread.showDetails")} onClick={() => setDetailsSheet(true)}>
              <Info aria-hidden />
            </Button>
          )}
        </header>

        <ConnectionBanner />
        <HuddleBanner conversationId={detail.id} />

        <div className="relative min-h-0 flex-1">
          <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain px-space-xs pb-space-md sm:px-space-md lg:px-space-lg">
            <div className="flex justify-center py-space-md">
              {thread.loadingOlder ? (
                <p role="status" className="type-label-md text-on-surface-variant">{t("thread.loadingOlder")}</p>
              ) : thread.hasOlder ? (
                <Button size="sm" variant="ghost" onClick={() => void loadOlder()}>{t("thread.loadOlder")}</Button>
              ) : (
                <p className="type-label-md text-on-surface-variant">
                  {detail.kind === "direct" ? t("thread.beginningDirect", { name }) : t("thread.beginning", { name: detail.kind === "channel" ? `#${name}` : name })}
                </p>
              )}
            </div>
            <div role="log" aria-label={t("thread.messagesLabel", { name })} aria-relevant="additions">
              {thread.messages.map((m, i) => {
                const previous = thread.messages[i - 1];
                return (
                  <Fragment key={m.client_id ?? m.id}>
                    {!previous || !sameDay(previous.created_at, m.created_at, timezone) ? <DaySeparator iso={m.created_at} /> : null}
                    <MessageItem
                      message={m}
                      showHeader={startsGroup(previous, m) || !previous || !sameDay(previous.created_at, m.created_at, timezone)}
                      receipt={receiptFor(m)}
                      onRetry={retry}
                      onDiscard={discard}
                      onEdit={edit}
                      onDelete={remove}
                    />
                  </Fragment>
                );
              })}
            </div>
          </div>
          {!atBottom ? (
            <Button size="sm" variant="primary" className="absolute bottom-space-md start-1/2 -translate-x-1/2 rtl:translate-x-1/2 shadow-level-2" onClick={() => scrollToBottom("smooth")}>
              <ArrowDown aria-hidden />
              {unseen ? t("thread.newBelow", { count: unseen }) : t("thread.jumpLatest")}
            </Button>
          ) : null}
        </div>

        <div className="px-space-sm pb-[max(var(--spacing-space-sm),env(safe-area-inset-bottom))] sm:px-space-md lg:px-space-lg lg:pb-space-md">
          <p aria-live="polite" className="h-5 px-space-xs type-label-md text-on-surface-variant">
            {typingNames.length === 1
              ? t("thread.typingOne", { name: typingNames[0] })
              : typingNames.length === 2
                ? t("thread.typingTwo", { a: typingNames[0], b: typingNames[1] })
                : typingNames.length > 2
                  ? t("thread.typingMany")
                  : ""}
          </p>
          <Composer ref={composer} key={conversationId} conversationId={conversationId} placeholder={placeholder} onSend={send} onTyping={notifyTyping} />
        </div>
      </section>

      {wide && showDetails ? <ThreadDetails detail={detail} messages={thread.messages} onLeft={() => setLoad({ state: "missing" })} /> : null}
      {!wide ? (
        <Sheet open={detailsSheet} onOpenChange={setDetailsSheet}>
          <SheetContent title={t("details.label")} hideTitle closeLabel={t("thread.cancel")} side="bottom">
            <ThreadDetails
              variant="sheet"
              detail={detail}
              messages={thread.messages}
              onLeft={() => {
                setDetailsSheet(false);
                setLoad({ state: "missing" });
              }}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

function DaySeparator({ iso }: { iso: string }) {
  const t = useTranslations("comms.thread");
  const format = useFormatter();
  const { timezone } = useComms();
  const date = new Date(iso);
  const now = new Date();
  const label = sameDay(iso, now.toISOString(), timezone)
    ? t("today")
    : sameDay(iso, new Date(now.getTime() - 86_400_000).toISOString(), timezone)
      ? t("yesterday")
      : format.dateTime(date, { timeZone: timezone, weekday: "long", day: "numeric", month: "long" });
  return (
    <div role="separator" aria-label={label} className="my-space-md flex items-center gap-space-md">
      <span aria-hidden className="h-px flex-1 bg-glass-line" />
      <span aria-hidden className="rounded-full bg-surface-container-high px-space-sm py-space-2xs type-label-xs uppercase text-on-surface-variant">{label}</span>
      <span aria-hidden className="h-px flex-1 bg-glass-line" />
    </div>
  );
}

function ThreadSkeleton() {
  const t = useTranslations("comms.thread");
  return (
    <div className="flex flex-1 flex-col gap-space-lg p-space-lg" role="status" aria-label={t("loading")}>
      <Skeleton className="h-10 w-1/3" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-space-md">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-space-xs">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-14 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
