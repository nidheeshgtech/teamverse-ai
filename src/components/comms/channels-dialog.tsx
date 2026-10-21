"use client";

import { Hash, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { CHANNEL_NAME, slugifyChannel } from "@/features/messaging/channel-name";
import type { ChannelListing } from "@/features/messaging/model";
import { ChatError } from "@/features/messaging/transport";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/ui/dialog";
import { FieldError, Input, Label } from "@/ui/input";
import { Skeleton, StateMessage } from "@/ui/states";
import { useComms } from "./comms-context";

// DESIGN GAP: Stitch shows only a "+" next to CHANNELS. Browse/create live in one level-3 dialog.
export function ChannelsDialog({ basePath, children }: { basePath: string; children: ReactNode }) {
  const t = useTranslations("comms");
  const { orgName } = useComms();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("browse");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTab("browse");
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={t("channels.title")} description={t("channels.description", { org: orgName })} closeLabel={t("thread.cancel")}>
        <Tabs.Root value={tab} onValueChange={setTab} className="flex flex-col gap-space-md">
          <Tabs.List aria-label={t("channels.title")} className="flex gap-space-2xs rounded-md bg-surface-container-low p-space-2xs">
            {(["browse", "create"] as const).map((value) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="flex-1 rounded px-space-sm py-space-xs type-label-lg text-on-surface-variant focus-visible:shadow-focus-ring focus-visible:outline-none data-[state=active]:bg-surface-container-high data-[state=active]:text-on-surface"
              >
                {t(value === "browse" ? "channels.browseTab" : "channels.createTab")}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="browse" className="outline-none">
            {open && tab === "browse" ? <BrowseChannels basePath={basePath} onDone={() => setOpen(false)} /> : null}
          </Tabs.Content>
          <Tabs.Content value="create" className="outline-none">
            <CreateChannel basePath={basePath} onDone={() => setOpen(false)} />
          </Tabs.Content>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}

function BrowseChannels({ basePath, onDone }: { basePath: string; onDone: () => void }) {
  const t = useTranslations("comms");
  const router = useRouter();
  const { transport, store } = useComms();
  const [channels, setChannels] = useState<ChannelListing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    transport.browseChannels().then(
      (list) => !cancelled && setChannels(list),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [transport]);

  const openChannel = async (channel: ChannelListing) => {
    setJoining(channel.id);
    try {
      if (!channel.is_member) {
        await transport.joinChannel(channel.id);
        await store.reload();
      }
      onDone();
      router.push(`${basePath}/${channel.id}`);
    } catch {
      setFailed(true);
    } finally {
      setJoining(null);
    }
  };

  if (failed) return <StateMessage tone="error" title={t("channels.loadFailed")} />;
  if (!channels)
    return (
      <div className="flex flex-col gap-space-sm" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  if (!channels.length) return <StateMessage title={t("channels.empty")} />;

  return (
    <ul className="flex flex-col gap-space-xs">
      {channels.map((c) => (
        <li key={c.id} className="flex items-center gap-space-sm rounded-md bg-surface-container-low px-space-sm py-space-sm">
          <Hash aria-hidden className="size-4 shrink-0 text-outline" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate type-label-lg text-on-surface">{c.name}</span>
            <span className="truncate type-body-sm text-on-surface-variant">
              {t("channels.memberCount", { count: c.member_count })}
              {c.topic ? ` · ${c.topic}` : ""}
            </span>
          </div>
          <Button size="sm" variant={c.is_member ? "glass" : "primary"} disabled={joining === c.id} onClick={() => void openChannel(c)}>
            {c.is_member ? t("channels.open") : t("channels.join")}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function CreateChannel({ basePath, onDone }: { basePath: string; onDone: () => void }) {
  const t = useTranslations("comms");
  const router = useRouter();
  const { transport, store } = useComms();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.replace(/-+$/, "");
    if (!CHANNEL_NAME.test(clean)) {
      setError(t("channels.nameInvalid"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const id = await transport.createConversation({ kind: "channel", memberIds: [], name: clean, topic: topic.trim() || undefined, visibility });
      await store.reload();
      onDone();
      router.push(`${basePath}/${id}`);
    } catch (err) {
      setError(err instanceof ChatError && /duplicate|unique/i.test(err.message) ? t("channels.nameTaken") : t("channels.failed"));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-space-md" noValidate>
      <div className="flex flex-col gap-space-xs">
        <Label htmlFor="channel-name">{t("channels.name")}</Label>
        <Input
          id="channel-name"
          required
          value={name}
          onChange={(e) => setName(slugifyChannel(e.target.value))}
          aria-describedby="channel-name-hint"
          aria-invalid={error === t("channels.nameInvalid") || undefined}
          autoComplete="off"
        />
        <p id="channel-name-hint" className="type-body-sm text-on-surface-variant">
          {t("channels.nameHint")}
        </p>
      </div>
      <div className="flex flex-col gap-space-xs">
        <Label htmlFor="channel-topic">{t("channels.topic")}</Label>
        <Input id="channel-topic" maxLength={500} value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="mb-space-xs type-label-md text-on-surface-variant">{t("channels.visibility")}</legend>
        {(["public", "private"] as const).map((value) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-start gap-space-sm rounded-md border px-space-sm py-space-sm has-[:focus-visible]:shadow-focus-ring",
              visibility === value ? "border-primary-container bg-primary-container/10" : "border-glass-line",
            )}
          >
            <input type="radio" name="visibility" value={value} checked={visibility === value} onChange={() => setVisibility(value)} className="sr-only" />
            {value === "public" ? <Hash aria-hidden className="mt-0.5 size-4 text-outline" /> : <Lock aria-hidden className="mt-0.5 size-4 text-outline" />}
            <span className="flex flex-col">
              <span className="type-label-lg text-on-surface">{t(`channels.${value}`)}</span>
              <span className="type-body-sm text-on-surface-variant">{t(`channels.${value}Hint`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending || !name}>
          {t("channels.create")}
        </Button>
      </div>
    </form>
  );
}
