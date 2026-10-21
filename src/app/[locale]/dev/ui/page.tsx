import { Mail, Phone, Search, Video } from "lucide-react";
import { notFound } from "next/navigation";
import { isDevPreviewEnabled } from "@/lib/env";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/ui/avatar";
import { Badge, Kbd } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Input, InputWithIcon, Label } from "@/ui/input";
import { Panel, PanelEyebrow } from "@/ui/panel";
import { PresenceDot, presenceStatuses } from "@/ui/presence";
import { Skeleton, StateMessage } from "@/ui/states";

// Developer-only gallery of tokens and base components, used for design-fidelity checks
// against /design/screens. Sample names below are demo data, not user-facing copy.
const colorTokens = [
  "surface-canvas", "surface-panel", "surface-container-lowest", "surface-container-low", "surface-container",
  "surface-container-high", "surface-container-highest", "primary", "primary-container", "secondary",
  "secondary-container", "tertiary", "tertiary-container", "error", "on-surface", "on-surface-variant", "outline",
  "outline-variant", "accent-desert-sand", "presence-online", "presence-busy", "presence-dnd", "presence-away",
  "dept-development", "dept-design", "dept-marketing", "dept-project-management", "dept-meeting-room",
] as const;

// Literal class names: Tailwind only generates utilities it can find verbatim in source.
const typeStyles = [
  ["display-lg", "type-display-lg"],
  ["headline-xl", "type-headline-xl"],
  ["headline-lg", "type-headline-lg"],
  ["headline-md", "type-headline-md"],
  ["title-md", "type-title-md"],
  ["body-lg", "type-body-lg"],
  ["body-md", "type-body-md"],
  ["body-sm", "type-body-sm"],
  ["label-lg", "type-label-lg"],
  ["label-md", "type-label-md"],
  ["label-xs", "type-label-xs"],
  ["code-sm", "type-code-sm"],
] as const;

export default async function DevGalleryPage() {
  if (!isDevPreviewEnabled()) notFound();
  const t = await getTranslations();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-space-xl p-margin">
      <header>
        <h1 className="type-headline-xl">{t("devGallery.title")}</h1>
        <p className="mt-space-xs type-body-md text-on-surface-variant">{t("devGallery.subtitle")}</p>
      </header>

      <section aria-labelledby="g-colors">
        <PanelEyebrow id="g-colors">Colors</PanelEyebrow>
        <ul className="mt-space-sm grid grid-cols-7 gap-space-sm">
          {colorTokens.map((token) => (
            <li key={token} className="flex flex-col gap-space-2xs">
              <span className="h-12 rounded border border-surface-glass-border" style={{ background: `var(--tv-color-${token})` }} />
              <code className="type-code-sm text-on-surface-variant">{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="g-type">
        <PanelEyebrow id="g-type">Typography</PanelEyebrow>
        <div className="mt-space-sm flex flex-col gap-space-xs">
          {typeStyles.map(([style, className]) => (
            <p key={style} className={className}>
              {style} — Dubai HQ, Level 42 · 14:45
            </p>
          ))}
        </div>
      </section>

      <section aria-labelledby="g-buttons" className="flex flex-col gap-space-sm">
        <PanelEyebrow id="g-buttons">Buttons</PanelEyebrow>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Button variant="primary">Primary</Button>
          <Button variant="glass"><Phone aria-hidden />Glass</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Leave Room</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button size="icon" aria-label="Video"><Video aria-hidden /></Button>
          <Button variant="primary" size="lg">Large primary</Button>
        </div>
      </section>

      <section aria-labelledby="g-inputs" className="grid grid-cols-3 gap-gutter">
        <PanelEyebrow id="g-inputs" className="col-span-3">Inputs</PanelEyebrow>
        <div className="flex flex-col gap-space-xs">
          <Label htmlFor="g-email">Email</Label>
          <Input id="g-email" placeholder="name@agency.ae" />
        </div>
        <div className="flex flex-col gap-space-xs">
          <Label htmlFor="g-search">Search</Label>
          <InputWithIcon id="g-search" icon={<Search />} placeholder="Search space, channels, team…" trailing={<Kbd>Ctrl K</Kbd>} />
        </div>
        <div className="flex flex-col gap-space-xs">
          <Label htmlFor="g-invalid">Invalid</Label>
          <Input id="g-invalid" aria-invalid defaultValue="not-an-email" />
        </div>
      </section>

      <section aria-labelledby="g-badges" className="flex flex-col gap-space-sm">
        <PanelEyebrow id="g-badges">Badges & presence</PanelEyebrow>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Badge>Neutral</Badge>
          <Badge tone="primary">Host</Badge>
          <Badge tone="secondary">Realtime</Badge>
          <Badge tone="warning">VIP</Badge>
          <Badge tone="danger">Live</Badge>
          <Badge tone="dept-development">Development</Badge>
          <Badge tone="dept-design">Design & UX</Badge>
          <Badge tone="dept-marketing">Marketing</Badge>
          <Badge tone="dept-project-management">PM & Ops</Badge>
          <Badge tone="dept-meeting-room">Meeting Room</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-space-lg">
          {presenceStatuses.map((status) => (
            <span key={status} className="flex items-center gap-space-xs type-label-md">
              <PresenceDot status={status} label={t(`presence.${status}`)} /> {t(`presence.${status}`)}
            </span>
          ))}
        </div>
        <div className="flex items-end gap-space-md">
          <Avatar name="Tariq Mansour" status="online" statusLabel={t("presence.online")} size="sm" />
          <Avatar name="Sara Al-Hashimi" status="busy" statusLabel={t("presence.busy")} size="md" />
          <Avatar name="Zayd Benali" status="dnd" statusLabel={t("presence.dnd")} size="lg" />
          <Avatar name="Noor Khalid" status="offline" statusLabel={t("presence.offline")} size="xl" />
        </div>
      </section>

      <section aria-labelledby="g-panels" className="grid grid-cols-3 gap-gutter">
        <PanelEyebrow id="g-panels" className="col-span-3">Elevation</PanelEyebrow>
        <Panel level={1}><p className="type-title-md">Level 1 — dock</p></Panel>
        <Panel level={2}>
          <PanelEyebrow>Office telemetry</PanelEyebrow>
          <p className="mt-space-xs type-title-md">Level 2 — card</p>
        </Panel>
        <Panel level={3}><p className="type-title-md">Level 3 — modal</p></Panel>
      </section>

      <section aria-labelledby="g-states" className="grid grid-cols-3 gap-gutter">
        <PanelEyebrow id="g-states" className="col-span-3">States (design gap)</PanelEyebrow>
        <Panel><Skeleton className="h-6 w-2/3" /><Skeleton className="mt-space-sm h-24" /></Panel>
        <Panel><StateMessage icon={<Mail />} title="Empty" description="No conversations yet." /></Panel>
        <Panel><StateMessage tone="error" icon={<Mail />} title="Error" description="Couldn't load messages." action={<Button size="sm">Retry</Button>} /></Panel>
      </section>
    </main>
  );
}
