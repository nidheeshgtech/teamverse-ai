import { PlugZap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { Panel } from "@/ui/panel";
import { StateMessage } from "@/ui/states";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signInTitle") };
}

export default async function SignInPage() {
  const t = await getTranslations();

  return (
    <Panel level={3} padding="lg" aria-labelledby="sign-in-title">
      <h1 id="sign-in-title" className="type-headline-lg text-on-surface">{t("auth.signInTitle")}</h1>
      <p className="mt-space-xs type-body-md text-on-surface-variant">{t("auth.signInSubtitle")}</p>
      {isSupabaseConfigured() ? (
        // useSearchParams (for ?next=) suspends during prerender.
        <Suspense>
          <SignInForm />
        </Suspense>
      ) : (
        <StateMessage tone="warning" icon={<PlugZap />} title={t("states.unconfiguredTitle")} description={t("states.unconfiguredBody")} />
      )}
      <p className="mt-space-lg type-body-sm text-on-surface-variant">{t("auth.inviteOnly")}</p>
      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-space-sm type-code-sm text-outline">{t("auth.demoHint")}</p>
      ) : null}
    </Panel>
  );
}
