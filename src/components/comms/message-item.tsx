"use client";

import { AlertCircle, CheckCheck, Check, Clock, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { memo, useEffect, useRef, useState } from "react";
import type { ThreadMessage } from "@/features/messaging/thread-state";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Dialog, DialogContent } from "@/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/menu";
import { departmentTone, useDepartmentLabel } from "../office/use-labels";
import { AttachmentList } from "./attachment-view";
import { useComms } from "./comms-context";
import { MessageBody } from "./message-body";

export type Receipt = { kind: "readBy"; count: number } | { kind: "seen" } | { kind: "sent" } | null;

type Props = {
  message: ThreadMessage;
  showHeader: boolean;
  receipt: Receipt;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (message: ThreadMessage) => Promise<void>;
};

// Stitch Communications › message card: avatar, name, department chip, time, body card.
// DESIGN DEVIATIONS: emoji reactions (⚡4) deferred (not in spec); "Read by 12" counts only people
// who share read receipts and appears under your own latest message.
export const MessageItem = memo(function MessageItem({ message, showHeader, receipt, onRetry, onDiscard, onEdit, onDelete }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const deptLabel = useDepartmentLabel();
  const { viewerId, people, personName, statusOf, timezone } = useComms();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState(false);

  const isOwn = message.sender_id === viewerId;
  const sender = message.sender_id ? people.get(message.sender_id) : undefined;
  const name = personName(message.sender_id);
  const time = format.dateTime(new Date(message.created_at), { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const fullTime = format.dateTime(new Date(message.created_at), { timeZone: timezone, dateStyle: "full", timeStyle: "short" });
  const deleted = Boolean(message.deleted_at);
  const canAct = isOwn && message.status === "sent" && !deleted;

  return (
    <article
      aria-labelledby={`msg-${message.id}-meta`}
      className={cn("group relative flex gap-space-md rounded-lg px-space-sm py-space-2xs hover:bg-surface-container-low/40 focus-within:bg-surface-container-low/40", showHeader && "mt-space-md")}
    >
      <div className="w-10 shrink-0">
        {showHeader ? (
          <Avatar name={name} src={sender?.avatarUrl} status={message.sender_id ? statusOf(message.sender_id) : undefined} decorative />
        ) : (
          <time
            dateTime={message.created_at}
            title={fullTime}
            className="invisible block pt-space-2xs text-center type-code-sm text-outline group-hover:visible group-focus-within:visible"
          >
            {time}
          </time>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div id={`msg-${message.id}-meta`} className={cn("flex flex-wrap items-baseline gap-space-xs", !showHeader && "sr-only")}>
          <span className="type-title-md text-on-surface">{name}</span>
          {sender?.departmentSlug ? <Badge tone={departmentTone(sender.departmentSlug)}>{deptLabel(sender.departmentSlug)}</Badge> : null}
          <time dateTime={message.created_at} title={fullTime} className="type-code-sm text-outline">
            {time}
          </time>
        </div>

        {deleted ? (
          <p className="type-body-md italic text-on-surface-variant">{t("comms.thread.deleted")}</p>
        ) : editing ? (
          <EditBox
            initial={message.body}
            onCancel={() => setEditing(false)}
            onSave={async (body) => {
              try {
                await onEdit(message.id, body);
                setEditing(false);
              } catch {
                setActionError(true);
              }
            }}
          />
        ) : (
          <div className={cn("w-fit max-w-3xl rounded-lg rounded-ss-sm bg-surface-container-low/70 px-space-md py-space-sm leading-relaxed", showHeader && "mt-space-xs", message.status !== "sent" && "opacity-70")}>
            {message.body ? <MessageBody body={message.body} /> : null}
            <AttachmentList attachments={message.attachments} pending={message.status === "sent" ? undefined : message.pendingFiles} />
            {message.edited_at ? <span className="type-label-xs text-outline">({t("comms.thread.edited")})</span> : null}
          </div>
        )}

        {message.status === "sending" ? (
          <p className="mt-space-2xs flex items-center gap-space-2xs type-label-xs text-on-surface-variant">
            <Clock aria-hidden className="size-3.5" />
            {t("comms.thread.sending")}
          </p>
        ) : message.status === "failed" ? (
          <p role="alert" className="mt-space-2xs flex flex-wrap items-center gap-space-xs type-label-xs text-error">
            <AlertCircle aria-hidden className="size-3.5" />
            {t("comms.thread.failed")}
            <button type="button" className="underline underline-offset-2 hover:text-on-surface" onClick={() => message.client_id && onRetry(message.client_id)}>
              {t("comms.thread.retrySend")}
            </button>
            <button type="button" className="underline underline-offset-2 hover:text-on-surface" onClick={() => message.client_id && onDiscard(message.client_id)}>
              {t("comms.thread.discard")}
            </button>
          </p>
        ) : receipt ? (
          <p className="mt-space-2xs flex items-center gap-space-2xs type-label-xs text-secondary">
            {receipt.kind === "sent" ? <Check aria-hidden className="size-3.5" /> : <CheckCheck aria-hidden className="size-3.5" />}
            {receipt.kind === "readBy" ? t("comms.thread.readBy", { count: receipt.count }) : receipt.kind === "seen" ? t("comms.thread.seen") : t("comms.thread.sent")}
          </p>
        ) : null}

        {actionError ? (
          <p role="alert" className="mt-space-2xs type-label-xs text-error">
            {t("comms.thread.actionFailed")}
          </p>
        ) : null}
      </div>

      {canAct && !editing ? (
        <div className="absolute -top-space-sm end-space-sm opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="glass" aria-label={t("comms.thread.actions")} className="size-8 px-0">
                <MoreHorizontal aria-hidden />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={() => setEditing(true)} disabled={!message.body}>
                <Pencil aria-hidden className="size-4" />
                {t("comms.thread.edit")}
              </MenuItem>
              <MenuItem onSelect={() => void navigator.clipboard?.writeText(message.body)} disabled={!message.body}>
                <Copy aria-hidden className="size-4" />
                {t("comms.thread.copy")}
              </MenuItem>
              <MenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive-text">
                <Trash2 aria-hidden className="size-4" />
                {t("comms.thread.delete")}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          title={t("comms.thread.confirmDelete")}
          description={t("comms.thread.confirmDeleteHint")}
          closeLabel={t("comms.thread.cancel")}
          footer={
            <>
              <Button onClick={() => setConfirmDelete(false)}>{t("comms.thread.cancel")}</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  setConfirmDelete(false);
                  try {
                    await onDelete(message);
                  } catch {
                    setActionError(true);
                  }
                }}
              >
                {t("comms.thread.delete")}
              </Button>
            </>
          }
        />
      </Dialog>
    </article>
  );
});

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (body: string) => Promise<void>; onCancel: () => void }) {
  const t = useTranslations("comms.thread");
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const save = async () => {
    const body = value.trim();
    if (!body || body === initial.trim()) return onCancel();
    setSaving(true);
    await onSave(body);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-space-xs">
      <textarea
        ref={ref}
        aria-label={t("editLabel")}
        value={value}
        maxLength={8000}
        rows={Math.min(8, value.split("\n").length + 1)}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void save();
          }
        }}
        className="w-full resize-none rounded border border-surface-glass-border bg-input-fill p-space-sm type-body-md text-on-surface focus-visible:border-primary-container focus-visible:shadow-focus-ring focus-visible:outline-none"
      />
      <div className="flex items-center gap-space-xs">
        <Button size="sm" variant="primary" disabled={saving} onClick={() => void save()}>
          {t("save")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <span className="ms-auto type-label-xs text-outline">{t("editHint")}</span>
      </div>
    </div>
  );
}
