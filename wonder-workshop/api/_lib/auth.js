// Shared API auth gate for the AI routes (chat / image / brand).
//
// WHY: these routes proxy paid Gemini calls and an outbound fetcher. With no
// auth they're an open billing relay — fine for a single-user localStorage app,
// not for a shared internet-facing backend. This gate verifies the caller's
// Supabase session (the same CM Google login the app uses) before any route
// does work, and applies a per-user rate-limit backstop.
//
// SAFE BY DEFAULT: auth only turns ON when the Supabase env is configured on the
// server. With no Supabase env (today's local-mode prod + local dev), the gate
// is a no-op and behavior is unchanged — so this can ship before cloud goes live
// and only starts enforcing the moment the cloud env vars are added.
//
// Reads SUPABASE_URL/SUPABASE_ANON_KEY, falling back to the VITE_-prefixed names
// (Vercel exposes those to functions at runtime too), so no extra env vars are
// needed beyond the ones the cloud go-live already sets.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// CM-family domains allowed to use the tool (mirrors the client AuthGate +
// Portal's auth callback). Who can authenticate IS the access control.
const ALLOWED_DOMAINS = ["@cm.studio", "@followthrough.studio", "@theminds.studio"];

export const AUTH_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Per-user rate-limit backstop (abuse guard, not a fairness throttle). Best-effort
// per-instance in-memory; a distributed store (Vercel KV / Upstash) is the robust
// upgrade if abuse ever materializes. Generous so heavy "regenerate all" bursts
// pass; only runaway/scripted volume trips it.
const RATE_LIMIT_PER_MIN = Number(process.env.AI_RATE_LIMIT_PER_MIN) || 300;
const WINDOW_MS = 60_000;
const _buckets = new Map(); // key -> { count, resetAt }

function rateLimited(key) {
  const now = Date.now();
  let b = _buckets.get(key);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + WINDOW_MS }; _buckets.set(key, b); }
  b.count++;
  if (_buckets.size > 5000) { // bound memory: drop expired buckets
    for (const [k, v] of _buckets) if (now > v.resetAt) _buckets.delete(k);
  }
  return b.count > RATE_LIMIT_PER_MIN;
}

function bearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  return String(h).replace(/^Bearer\s+/i, "").trim();
}

// Returns { ok:true, user } when allowed, or { ok:false, status, error } when not.
export async function requireAuth(req) {
  if (!AUTH_ENABLED) return { ok: true, mode: "open" }; // local / pre-cloud: unchanged
  const token = bearer(req);
  if (!token) return { ok: false, status: 401, error: "Sign in to use Wonder Workshop." };

  let user;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { ok: false, status: 401, error: "Your session expired — sign in again." };
    user = await r.json();
  } catch {
    return { ok: false, status: 503, error: "Couldn't verify your session. Try again." };
  }

  const email = String(user?.email || "").toLowerCase();
  if (!ALLOWED_DOMAINS.some((d) => email.endsWith(d))) {
    return { ok: false, status: 403, error: "Not a Conscious Minds account." };
  }
  if (rateLimited(user.id || email)) {
    return { ok: false, status: 429, error: "Too many requests — slow down a moment." };
  }
  return { ok: true, user };
}

// Convenience wrapper for route handlers: writes the error response itself and
// returns null when blocked, or the auth result when allowed.
//   const auth = await gate(req, res); if (!auth) return;
export async function gate(req, res) {
  const a = await requireAuth(req);
  if (!a.ok) {
    res.status(a.status).json({ error: a.error });
    return null;
  }
  return a;
}
