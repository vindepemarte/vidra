"use client";

import { useEffect, useMemo, useState } from "react";

import { API_URL } from "@/lib/api";

const STORAGE_KEY = "vidra_cookie_preferences";

type CookiePrefs = {
  session_id: string;
  analytics: boolean;
  marketing: boolean;
  saved_at: string;
};

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server-session";
  const existing = window.localStorage.getItem("vidra_cookie_session_id");
  if (existing) return existing;
  const created = randomId();
  window.localStorage.setItem("vidra_cookie_session_id", created);
  return created;
}

export function CookieBanner() {
  const [prefs, setPrefs] = useState<CookiePrefs | null>(null);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setOpen(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as CookiePrefs;
      setPrefs(parsed);
      setAnalytics(parsed.analytics);
      setMarketing(parsed.marketing);
    } catch {
      setOpen(true);
    }
  }, []);

  const shouldShow = useMemo(() => open || !prefs, [open, prefs]);

  async function persist(nextAnalytics: boolean, nextMarketing: boolean) {
    const session_id = getOrCreateSessionId();
    const payload: CookiePrefs = {
      session_id,
      analytics: nextAnalytics,
      marketing: nextMarketing,
      saved_at: new Date().toISOString()
    };

    setBusy(true);
    try {
      await fetch(`${API_URL}/api/consent/cookies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id,
          analytics: nextAnalytics,
          marketing: nextMarketing
        })
      });
    } catch {
      // ignore network error: local preference still stored
    } finally {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setPrefs(payload);
      setAnalytics(nextAnalytics);
      setMarketing(nextMarketing);
      setOpen(false);
      setBusy(false);
    }
  }

  if (!shouldShow) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-lg border border-cyan-300/40 bg-slate-950/85 px-3 py-2 text-xs font-bold text-cyan-100"
      >
        Cookie settings
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-cyan-300/35 bg-slate-950/95 p-4 text-xs text-slate-100 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <p>
          <span className="font-bold text-cyan-100">Vidra by Lexa AI</span> uses essential cookies and optional analytics/marketing cookies.
          You can manage your preferences anytime.
        </p>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled />
            Essential (always on)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            Analytics
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            Marketing
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => persist(false, false)}
            className="rounded-lg border border-cyan-300/40 px-3 py-2 font-bold text-cyan-100 disabled:opacity-50"
          >
            Reject optional
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => persist(analytics, marketing)}
            className="rounded-lg bg-cyan-400 px-3 py-2 font-black text-slate-950 disabled:opacity-50"
          >
            Save preferences
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => persist(true, true)}
            className="rounded-lg border border-lime-300/40 bg-lime-400/10 px-3 py-2 font-bold text-lime-100 disabled:opacity-50"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
