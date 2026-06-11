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
