import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";
import { getPublicSupabaseConfig } from "@/lib/env";
import { isPublicPath, SIGN_IN_PATH } from "@/lib/auth/paths";

const handleI18n = createIntlMiddleware(routing);

// Optimistic checks only: refresh the Supabase session cookie and bounce signed-out users
// to sign-in. Real authorization happens in the data access layer and in Postgres RLS.
export async function proxy(request: NextRequest) {
  const response = handleI18n(request);
  const config = getPublicSupabaseConfig();
  if (!config) return response; // Unconfigured: pages render the "Supabase not configured" state.

  const supabase = createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = SIGN_IN_PATH;
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return withCookies(NextResponse.redirect(url), response);
  }

  if (signedIn && pathname === SIGN_IN_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}

function withCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export const config = {
  // Skip Next internals, static files and the auth callback route handler.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
