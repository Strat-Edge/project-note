import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";

const LOGIN_PATH = "/login";

function redirectWithRefreshedCookies(url: URL, refreshedResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  refreshedResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Un cookie de session corrompu (JWT malformé) ou une variable d'env manquante peut faire
  // lever une exception non-AuthError ici — y compris pendant la construction du client
  // Supabase (requireEnv) — on échoue alors vers "non authentifié" plutôt que de planter le
  // proxy sur toutes les routes qu'il protège.
  let isAuthenticated: boolean;
  try {
    const supabase = createServerClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );
    const { data } = await supabase.auth.getClaims();
    isAuthenticated = data !== null;
  } catch {
    isAuthenticated = false;
  }

  const isLoginRoute = request.nextUrl.pathname === LOGIN_PATH;

  if (!isAuthenticated && !isLoginRoute) {
    return redirectWithRefreshedCookies(
      new URL(LOGIN_PATH, request.url),
      response,
    );
  }

  if (isAuthenticated && isLoginRoute) {
    return redirectWithRefreshedCookies(new URL("/", request.url), response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|manifest.webmanifest|sw.js|robots.txt|brand/|icons/|splash/).*)",
  ],
};
