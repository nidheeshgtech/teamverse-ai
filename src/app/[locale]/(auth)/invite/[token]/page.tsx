import { MailX, PlugZap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { getInvitationPreview } from "@/features/invitations/queries";
import { Panel } from "@/ui/panel";
import { Skeleton, StateMessage } from "@/ui/states";
import { AcceptNewAccountForm, AcceptSignedInForm } from "./accept-forms";

export async function generateMetadata() {
  const t = await getTranslations("invite");
  return { title: t("title"), robots: { index: false } };
}

export default function InvitePage({ params }: PageProps<"/[locale]/invite/[token]">) {
  return (
    <Panel level={3} padding="lg">
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <InviteContent params={params} />
      </Suspense>
    </Panel>
  );
}

async function InviteContent({ params }: { params: PageProps<"/[locale]/invite/[token]">["params"] }) {
  const t = await getTranslations();
  if (!isSupabaseConfigured()) {
    return <StateMessage titleAs="h1" tone="warning" icon={<PlugZap />} title={t("states.unconfiguredTitle")} description={t("states.unconfiguredBody")} />;
  }

  const { token } = await params;
  const [preview, viewer] = await Promise.all([getInvitationPreview(token), getViewer()]);

  if (!preview || preview.status !== "valid") {
    const key = preview && preview.status !== "valid" ? preview.status : "invalid";
    return <StateMessage titleAs="h1" tone="error" icon={<MailX />} title={t("invite.title")} description={t(`invite.${key}`)} />;
  }

  const role = t(`roles.${preview.role}`);

  return (
    <div>
      <h1 className="type-headline-lg text-on-surface">{t("invite.title")}</h1>
      <p className="mt-space-xs type-body-lg text-on-surface">{t("invite.body", { org: preview.org_name, role })}</p>
      <p className="mt-space-2xs type-body-sm text-on-surface-variant">{t("invite.forEmail", { email: preview.email })}</p>

      {viewer ? (
        viewer.user.email.toLowerCase() === preview.email.toLowerCase() ? (
          <AcceptSignedInForm token={token} orgName={preview.org_name} />
        ) : (
          <p role="alert" className="mt-space-lg type-body-md text-error">{t("invite.wrongAccount", { email: viewer.user.email })}</p>
        )
      ) : (
        <AcceptNewAccountForm token={token} />
      )}
    </div>
  );
}
