"use client";

import { Download, FileText, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatBytes, INLINE_IMAGE_TYPES } from "@/features/messaging/attachments";
import type { Attachment } from "@/features/messaging/model";
import type { LocalFile } from "@/features/messaging/thread-state";
import { useComms } from "./comms-context";

// Files are private: every view/download uses a short-lived signed URL minted for the viewer.
// DESIGN DEVIATION: Stitch's "Encrypted E2EE" / "Sovereign Signed" file labels are not shown.
export function AttachmentList({ attachments, pending }: { attachments: Attachment[]; pending?: LocalFile[] }) {
  const t = useTranslations("comms.attachment");
  if (!attachments.length && !pending?.length) return null;
  return (
    <ul className="mt-space-xs flex flex-wrap gap-space-xs">
      {attachments.map((a) => (
        <li key={a.id}>{INLINE_IMAGE_TYPES.has(a.mime_type) ? <ImageAttachment attachment={a} /> : <FileAttachment attachment={a} />}</li>
      ))}
      {pending?.map((f, i) => (
        <li key={`pending-${i}`} className="flex items-center gap-space-sm rounded-md border border-dashed border-glass-line px-space-sm py-space-xs type-body-sm text-on-surface-variant">
          <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
          {t("uploading", { name: f.name })}
        </li>
      ))}
    </ul>
  );
}

function useSignedUrl(path: string, downloadName?: string, eager = false) {
  const { transport } = useComms();
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });

  const load = async () => {
    try {
      const url = await transport.signedUrl(path, downloadName);
      setState({ url, failed: false });
      return url;
    } catch {
      setState({ url: null, failed: true });
      return null;
    }
  };

  useEffect(() => {
    if (!eager) return;
    let cancelled = false;
    transport.signedUrl(path, downloadName).then(
      (url) => !cancelled && setState({ url, failed: false }),
      () => !cancelled && setState({ url: null, failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [eager, path, downloadName, transport]);

  return { ...state, load };
}

function ImageAttachment({ attachment }: { attachment: Attachment }) {
  const t = useTranslations("comms.attachment");
  const { url, failed } = useSignedUrl(attachment.storage_path, undefined, true);
  if (failed) return <FileAttachment attachment={attachment} />;
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("image", { name: attachment.file_name })}
      className="block overflow-hidden rounded-md border border-glass-line bg-surface-container-low focus-visible:shadow-focus-ring focus-visible:outline-none"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would cache it
        <img src={url} alt="" loading="lazy" className="max-h-64 max-w-80 object-cover" />
      ) : (
        <span aria-hidden className="block h-40 w-64 bg-surface-container-high motion-safe:animate-pulse" />
      )}
    </a>
  );
}

function FileAttachment({ attachment }: { attachment: Attachment }) {
  const t = useTranslations("comms.attachment");
  const locale = useLocale();
  const { failed, load } = useSignedUrl(attachment.storage_path, attachment.file_name);
  const [busy, setBusy] = useState(false);

  // Mint the link on click so it is fresh, then let the browser download it.
  const download = async () => {
    setBusy(true);
    const url = await load();
    setBusy(false);
    if (url) window.location.assign(url);
  };

  return (
    <div className="flex w-72 items-center gap-space-sm rounded-md border border-glass-line bg-surface-container-low px-space-sm py-space-sm">
      <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded bg-surface-container-high text-secondary">
        <FileText className="size-4.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-label-lg text-on-surface">{attachment.file_name}</span>
        <span className="type-code-sm text-on-surface-variant">{failed ? t("unavailable") : formatBytes(attachment.size_bytes, locale)}</span>
      </span>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        aria-label={t("download", { name: attachment.file_name })}
        className="inline-flex size-8 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none disabled:opacity-50"
      >
        {busy ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : <Download aria-hidden className="size-4" />}
      </button>
    </div>
  );
}
