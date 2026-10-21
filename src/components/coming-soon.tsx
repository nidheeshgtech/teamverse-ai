import { Hammer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/auth/dal";
import { Panel } from "@/ui/panel";
import { StateMessage } from "@/ui/states";

type Section = "conferences" | "voiceNotes" | "ai";

const phaseFor: Record<Section, number> = { conferences: 4, voiceNotes: 5, ai: 6 };

/** Honest placeholder for sections that later phases build. Still enforces membership. */
export async function ComingSoon({ section }: { section: Section }) {
  await requireMember();
  const t = await getTranslations();
  return (
    <div className="p-margin">
      <h1 className="type-headline-lg text-on-surface">{t(`nav.${section}`)}</h1>
      <Panel level={2} padding="lg" className="mt-space-lg">
        <StateMessage
          titleAs="h2"
          icon={<Hammer />}
          title={t("comingSoon.title", { section: t(`nav.${section}`) })}
          description={`${t("comingSoon.body", { phase: phaseFor[section] })} ${t(`comingSoon.${section}`)}`}
        />
      </Panel>
    </div>
  );
}
