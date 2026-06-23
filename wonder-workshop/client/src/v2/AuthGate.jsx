import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { STORAGE_MODE } from "./persistence.js";

// CM-family domains allowed to sign in (mirrors Portal's auth callback). Cloud
// data is a flat shared workspace, so who can authenticate IS the access control.
const ALLOWED_DOMAINS = ["@cm.studio", "@followthrough.studio", "@theminds.studio"];
const allowed = email => !!email && ALLOWED_DOMAINS.some(d => email.toLowerCase().endsWith(d));

// Gates the app behind a Supabase session — but ONLY in cloud storage mode. In
// local mode it renders children directly (no login, current behavior).
export default function AuthGate({ children }) {
  if (STORAGE_MODE !== "cloud" || !supabase) return children;
  return <CloudAuthGate>{children}</CloudAuthGate>;
}

function CloudAuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [rejected, setRejected] = useState(null);

  useEffect(() => {
    let active = true;
    // Single handler for both the initial session and later auth changes. Enforce
    // the CM-domain allowlist here: a non-CM Google account is signed straight
    // back out. (DB-level enforcement via RLS is a follow-up.)
    const handle = s => {
      if (!active) return;
      if (s && !allowed(s.user?.email)) {
        setRejected(s.user?.email || "that account");
        supabase.auth.signOut();
        setSession(null);
        return;
      }
      setSession(s);
    };
    supabase.auth.getSession().then(({ data }) => handle(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => handle(s));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  if (session === undefined) return <Screen>Loading…</Screen>;
  if (!session) return <SignIn rejected={rejected} />;
  return children;
}

function SignIn({ rejected }) {
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    const redirectTo = window.location.origin + window.location.pathname + window.location.search;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) { console.error("[auth] sign-in failed", error); setBusy(false); }
  };
  return (
    <Screen>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontFamily: "var(--f, system-ui)", fontSize: 26, fontWeight: 250, letterSpacing: "-0.03em", color: "#fbf7f2", marginBottom: 10 }}>
          Wonder Workshop
        </div>
        <p style={{ fontFamily: "var(--f, system-ui)", fontSize: 14, lineHeight: 1.55, color: "rgba(244,244,245,0.6)", margin: "0 0 22px" }}>
          {rejected
            ? `${rejected} isn't a Conscious Minds account. Sign in with your CM Google account.`
            : "Sign in with your Conscious Minds Google account to access shared projects."}
        </p>
        <button
          onClick={signIn}
          disabled={busy}
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "11px 20px", borderRadius: 999, border: "none",
            background: "#f4f1ec", color: "#15120f", cursor: busy ? "default" : "pointer",
            fontFamily: "var(--f, system-ui)", fontSize: 15, fontWeight: 600,
            boxShadow: "0 2px 14px rgba(0,0,0,0.25)", opacity: busy ? 0.7 : 1,
          }}
        >
          <GoogleG />
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>
    </Screen>
  );
}

function Screen({ children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
      background: "#0a0807", color: "#f4f4f5", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {children}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
