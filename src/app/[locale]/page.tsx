import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth/dal";
import { SIGN_IN_PATH } from "@/lib/auth/paths";
import { homePathFor } from "@/lib/auth/roles";

export default function RootPage() {
  return (
    <Suspense>
      <RoleRedirect />
    </Suspense>
  );
}

/** "/" sends admins to the 3D office dashboard and employees to their inbox. */
async function RoleRedirect(): Promise<null> {
  const viewer = await getViewer();
  if (!viewer) redirect(SIGN_IN_PATH);
  if (!viewer.membership) redirect("/no-organization");
  redirect(homePathFor(viewer.membership.role));
}
