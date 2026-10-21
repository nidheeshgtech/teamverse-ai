"use client";

import { Bold, Code, Italic, List, Mic, Paperclip, Quote, SendHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { checkFiles, MAX_ATTACHMENTS } from "@/features/messaging/attachments";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";

export const MAX_MESSAGE_LENGTH = 8000;

export type ComposerHandle = { addFiles: (files: File[]) => void; focus: () => void };

type Props = {
  ref?: Ref<ComposerHandle>;
  conversationId: string;
  placeholder: string;
  onSend: (input: { body: string; files: File[] }) => void;
  onTyping: () => void;
};

// Unsent text survives switching conversations (memory only; never written to storage).
const drafts = new Map<string, string>();

// Stitch Communications › composer card: formatting row, text area, Attach / Voice Memo / Send.
// DESIGN DEVIATIONS: "Send an encrypted broadcast…" placeholder → "Message #channel" (not E2EE);
// "Transmit" → "Send"; RTL/العربية toggle omitted until Phase 8; Voice Memo disabled until Phase 5;
// emoji button omitted (reactions deferred).
export function Composer({ ref, conversationId, placeholder, onSend, onTyping }: Props) {
  const t = useTranslations("comms.composer");
  const tThread = useTranslations("comms.thread");
  const [value, setValue] = useState(() => drafts.get(conversationId) ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (next: string) => {
    setValue(next);
    drafts.set(conversationId, next);
  };

  const addFiles = (incoming: File[]) => {
    const { ok, rejected } = checkFiles(incoming, files.length);
    setFiles((current) => [...current, ...(ok as File[])]);
    setProblems(
      rejected.map((r) =>
        r.problem === "tooMany" ? t("fileTooMany") : r.problem === "tooLarge" ? t("fileTooLarge", { name: r.name }) : r.problem === "empty" ? t("fileEmpty", { name: r.name }) : t("fileType", { name: r.name }),
      ),
    );
  };

  useImperativeHandle(ref, () => ({ addFiles, focus: () => textarea.current?.focus() }));

  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const canSend = (value.trim().length > 0 || files.length > 0) && !tooLong;

  const send = () => {
    if (!canSend) return;
    onSend({ body: value.trim(), files });
    update("");
    setFiles([]);
    setProblems([]);
    textarea.current?.focus();
  };

  /** Wraps the selection (or inserts a placeholder) with markdown the renderer understands. */
  const format = (kind: "bold" | "italic" | "code" | "list" | "quote") => {
    const el = textarea.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end);
    let insert: string;
    if (kind === "bold") insert = `**${selected || "bold"}**`;
    else if (kind === "italic") insert = `*${selected || "italic"}*`;
    else if (kind === "code") insert = selected.includes("\n") || !selected ? `\n\`\`\`\n${selected}\n\`\`\`\n` : `\`${selected}\``;
    else {
      const prefix = kind === "list" ? "- " : "> ";
      insert = (selected || "").split("\n").map((line) => prefix + line).join("\n");
    }
    const next = value.slice(0, start) + insert + value.slice(end);
    update(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  };

  return (
    <div
      className="glass-level-2 flex flex-col gap-space-xs rounded-lg p-space-sm"
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        addFiles([...e.dataTransfer.files]);
      }}
    >
      <div role="toolbar" aria-label={t("formatting")} className="flex items-center gap-space-2xs">
        <ToolButton label={t("bold")} onClick={() => format("bold")}><Bold /></ToolButton>
        <ToolButton label={t("italic")} onClick={() => format("italic")}><Italic /></ToolButton>
        <ToolButton label={t("code")} onClick={() => format("code")}><Code /></ToolButton>
        <ToolButton label={t("list")} onClick={() => format("list")}><List /></ToolButton>
        <ToolButton label={t("quote")} onClick={() => format("quote")}><Quote /></ToolButton>
        <span id="composer-hint" className="ms-auto truncate pe-space-xs type-label-xs text-outline">
          {t("hint")}
        </span>
      </div>

      <textarea
        ref={textarea}
        value={value}
        aria-label={t("label")}
        aria-describedby="composer-hint"
        aria-invalid={tooLong || undefined}
        placeholder={placeholder}
        rows={Math.min(8, Math.max(2, value.split("\n").length))}
        onChange={(e) => {
          update(e.target.value);
          if (e.target.value) onTyping();
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length) {
            e.preventDefault();
            addFiles([...e.clipboardData.files]);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        className="w-full resize-none bg-transparent px-space-xs py-space-2xs type-body-md leading-relaxed text-on-surface placeholder:text-on-surface-variant focus-visible:outline-none"
      />

      {files.length ? (
        <ul className="flex flex-wrap gap-space-xs px-space-xs">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-space-2xs rounded-sm bg-surface-container-high py-space-2xs ps-space-sm pe-space-2xs type-label-md text-on-surface">
              <span className="max-w-48 truncate">{file.name}</span>
              <button
                type="button"
                aria-label={t("removeFile", { name: file.name })}
                onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                className="inline-flex size-5 items-center justify-center rounded-sm text-on-surface-variant hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {problems.length || tooLong ? (
        <ul role="alert" className="flex flex-col px-space-xs type-body-sm text-error">
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
          {tooLong ? <li>{t("tooLong", { max: MAX_MESSAGE_LENGTH.toLocaleString() })}</li> : null}
        </ul>
      ) : null}

      <div className="flex items-center gap-space-2xs border-t border-glass-line pt-space-xs">
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()} disabled={files.length >= MAX_ATTACHMENTS}>
          <Paperclip aria-hidden />
          {t("attach")}
        </Button>
        <Button size="sm" variant="ghost" aria-disabled title={tThread("phaseHint", { phase: 5 })} className="cursor-not-allowed opacity-50 hover:bg-transparent" onClick={(e) => e.preventDefault()}>
          <Mic aria-hidden />
          {t("voiceMemo")}
        </Button>
        <Button size="sm" variant="primary" onClick={send} disabled={!canSend} className="ms-auto px-space-md">
          {t("send")}
          <SendHorizontal aria-hidden className="icon-directional" />
        </Button>
      </div>
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        "focus-visible:shadow-focus-ring focus-visible:outline-none [&_svg]:size-4",
      )}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
