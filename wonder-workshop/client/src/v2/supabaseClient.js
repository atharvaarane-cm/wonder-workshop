import { createClient } from "@supabase/supabase-js";

// Browser Supabase client for Workshop, pointed at Portal's project (the shared
// workspace). Uses the ANON key — all data access is gated by row-level security
// (a logged-in CM user can read/write every workshop_projects row; anon can't).
//
// Auth: for now this uses supabase-js's default session storage. The cross-
// subdomain hand-off (reading Portal's `.cm.studio` session) is wired separately
// once Portal's cookie domain is set — see the backend plan.
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && anon
    ? createClient(url, anon, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

// Whether cloud storage is even configured (keys present). Lets persistence.js
// fall back to local storage cleanly when it isn't.
export const hasSupabase = !!supabase;

export const WORKSHOP_BUCKET = "workshop-images";

// --- API auth: attach the Supabase session token to our own /api/* calls ---
// The AI routes (chat/image/brand) verify this token server-side once cloud is
// live. Rather than thread the header through ~11 scattered fetch sites, install
// one fetch interceptor that adds `Authorization: Bearer <token>` to same-origin
// /api/* requests when a session exists. No-op in local mode (supabase is null,
// so the interceptor is never installed and the server never requires it).
let _accessToken = null;
if (supabase) {
  supabase.auth.getSession().then(({ data }) => { _accessToken = data?.session?.access_token || null; });
  supabase.auth.onAuthStateChange((_event, session) => { _accessToken = session?.access_token || null; });

  if (typeof window !== "undefined" && typeof window.fetch === "function" && !window.__wwAuthFetchInstalled) {
    window.__wwAuthFetchInstalled = true;
    const orig = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      try {
        const urlStr = typeof input === "string" ? input : (input && input.url) || "";
        const isOwnApi = urlStr.startsWith("/api/") || urlStr.startsWith(window.location.origin + "/api/");
        if (isOwnApi && _accessToken) {
          const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined) || {});
          if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${_accessToken}`);
          init = { ...init, headers };
        }
      } catch { /* never let auth wiring break a request */ }
      return orig(input, init);
    };
  }
}
