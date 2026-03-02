"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { LogoutButton } from "@/components/logout-button";
import { API_URL } from "@/lib/api";

type Persona = {
  id: string;
  name: string;
  handle: string;
  age: number;
  city: string;
  niche: string;
  vibe: string;
  template: string;
};

type PersonaProfile = {
  bio: string;
  backstory_md: string;
  future_plans_md: string;
  strategy_md: string;
  prompt_blueprint: string;
  physical: Record<string, unknown>;
  wardrobe: Record<string, unknown>;
  beauty: Record<string, unknown>;
  world: Record<string, unknown>;
  carousel_rules: Record<string, unknown>;
  generated_mode: string;
};

type CalendarMonthSummary = {
  id: string;
  month: number;
  year: number;
  mode: string;
  days_count: number;
};

type PersonaDetail = {
  persona: Persona;
  profile?: PersonaProfile | null;
  calendars: CalendarMonthSummary[];
};

type CalendarSlide = {
  slide_number: number;
  prompt: string;
  edit_instruction?: string | null;
};

type CalendarPost = {
  post_number: number;
  time: string;
  scene_type: string;
  caption: string;
  prompt: string;
  hashtags: string;
  slides: CalendarSlide[];
};

type CalendarDay = {
  day: number;
  date: string;
  theme: string;
  mood: string;
  posts: CalendarPost[];
};

type CalendarMonth = {
  persona_id: string;
  month: number;
  year: number;
  mode: string;
  days: CalendarDay[];
};

type MyPlan = {
  current_tier: string;
  generation_mode: string;
  openrouter_enabled?: boolean;
  openrouter_model?: string | null;
};

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const payload = JSON.parse(text) as { detail?: string };
    if (payload.detail) {
      return payload.detail;
    }
  } catch {
    // no-op
  }
  return text || `Request failed (${res.status})`;
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function PersonaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const personaId = params.id;

  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;

  const [detail, setDetail] = useState<PersonaDetail | null>(null);
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [loadedMonth, setLoadedMonth] = useState<CalendarMonth | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyLoadMonth, setBusyLoadMonth] = useState(false);
  const [busyRegenerate, setBusyRegenerate] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [error, setError] = useState("");

  const calendarArchive = useMemo(() => detail?.calendars ?? [], [detail?.calendars]);

  async function loadPersonaDetail(autoLoadLatest = true): Promise<void> {
    if (!token || !personaId) return;

    try {
      setLoading(true);
      setError("");

      const [detailRes, planRes] = await Promise.all([
        fetch(`${API_URL}/api/personas/${personaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/plans/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!detailRes.ok) throw new Error(await extractErrorMessage(detailRes));
      if (!planRes.ok) throw new Error(await extractErrorMessage(planRes));

      const detailPayload = (await detailRes.json()) as PersonaDetail;
      const planPayload = (await planRes.json()) as MyPlan;

      setDetail(detailPayload);
      setMyPlan(planPayload);

      if (autoLoadLatest && detailPayload.calendars[0]) {
        const latest = detailPayload.calendars[0];
        setSelectedMonthKey(monthKey(latest.year, latest.month));
        await loadMonth(latest.year, latest.month);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load persona");
    } finally {
      setLoading(false);
    }
  }

  async function loadMonth(year: number, month: number): Promise<void> {
    if (!token || !personaId) return;

    try {
      setBusyLoadMonth(true);
      setError("");

      const res = await fetch(`${API_URL}/api/calendar/${personaId}/${year}/${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as CalendarMonth;
      setLoadedMonth(payload);
      setSelectedMonthKey(monthKey(year, month));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load month");
    } finally {
      setBusyLoadMonth(false);
    }
  }

  async function regenerateProfile(mode: "auto" | "offline" | "llm"): Promise<void> {
    if (!token || !personaId || busyRegenerate) return;

    try {
      setBusyRegenerate(mode);
      setError("");

      const res = await fetch(`${API_URL}/api/personas/${personaId}/profile/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));
      await loadPersonaDetail(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot regenerate profile");
    } finally {
      setBusyRegenerate(null);
    }
  }

  async function deletePersona(): Promise<void> {
    if (!token || !personaId || busyDelete || !detail?.persona) return;

    const ok = window.confirm(`Delete ${detail.persona.name}? This removes profile and calendars.`);
    if (!ok) return;

    try {
      setBusyDelete(true);
      setError("");

      const res = await fetch(`${API_URL}/api/personas/${personaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete persona");
    } finally {
      setBusyDelete(false);
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && token && personaId) {
      void loadPersonaDetail(true);
    }
  }, [status, token, personaId, router]);

  if (status === "loading" || loading) {
    return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">Loading persona deck...</main>;
  }

  if (!detail) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">
        <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">Persona not found.</p>
      </main>
    );
  }

  const profile = detail.profile;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-7">
      <section className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/10 text-xl font-black text-cyan-100">
              {detail.persona.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">Persona Control Layer</p>
              <h1 className="mt-1 text-2xl font-black sm:text-4xl">{detail.persona.name}</h1>
              <p className="text-sm text-slate-300">@{detail.persona.handle} · {detail.persona.city} · {detail.persona.niche}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-100">
              Back to Dashboard
            </Link>
            <Link href="/settings" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-100">
              Settings
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
            <p className="text-xs uppercase tracking-wide text-cyan-100/75">Tier</p>
            <p className="mt-1 text-xl font-black">{myPlan?.current_tier.toUpperCase() ?? "FREE"}</p>
          </article>
          <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
            <p className="text-xs uppercase tracking-wide text-cyan-100/75">Profile Mode</p>
            <p className="mt-1 text-xl font-black">{profile?.generated_mode?.toUpperCase() ?? "OFFLINE"}</p>
          </article>
          <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
            <p className="text-xs uppercase tracking-wide text-cyan-100/75">Saved Calendars</p>
            <p className="mt-1 text-xl font-black">{calendarArchive.length}</p>
          </article>
        </div>

        {myPlan?.openrouter_model ? (
          <p className="mt-3 rounded-md border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            Active paid model: <span className="font-bold">{myPlan.openrouter_model}</span>
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-4">
          <h2 className="text-lg font-black">Profile Actions</h2>
          <p className="mt-1 text-xs text-slate-300">Regenerate this persona intelligence stack whenever you change niche/city/vibe.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => regenerateProfile("auto")}
              disabled={busyRegenerate !== null}
              className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {busyRegenerate === "auto" ? "Generating..." : "Regenerate Profile (Auto)"}
            </button>
            <button
              type="button"
              onClick={() => regenerateProfile("offline")}
              disabled={busyRegenerate !== null}
              className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"
            >
              {busyRegenerate === "offline" ? "Generating..." : "Force Offline"}
            </button>
            <button
              type="button"
              onClick={() => regenerateProfile("llm")}
              disabled={busyRegenerate !== null}
              className="rounded-lg border border-orange-300/40 px-4 py-2 text-sm font-bold text-orange-200 disabled:opacity-50"
            >
              {busyRegenerate === "llm" ? "Generating..." : "Force LLM"}
            </button>
          </div>
          <button
            type="button"
            onClick={deletePersona}
            disabled={busyDelete}
            className="mt-3 rounded-lg border border-red-300/40 px-4 py-2 text-sm font-bold text-red-200 disabled:opacity-50"
          >
            {busyDelete ? "Deleting..." : "Delete Persona"}
          </button>
        </article>

        <article className="panel p-4">
          <h2 className="text-lg font-black">Bio & Prompt Blueprint</h2>
          <p className="mt-1 rounded-lg border border-cyan-300/20 bg-slate-950/50 px-3 py-2 text-sm text-slate-100">
            {profile?.bio || "No bio generated yet."}
          </p>
          <h3 className="mt-3 text-sm font-bold uppercase tracking-wide text-cyan-100">Master Image Prompt</h3>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-cyan-300/20 bg-slate-950/60 p-3 text-xs text-slate-100">
            {profile?.prompt_blueprint || "No prompt blueprint yet."}
          </pre>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-4">
          <h2 className="text-lg font-black">Backstory</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-cyan-300/20 bg-slate-950/60 p-3 text-xs text-slate-100">
            {profile?.backstory_md || "No backstory yet."}
          </pre>
        </article>
        <article className="panel p-4">
          <h2 className="text-lg font-black">Future Plans & Strategy</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-cyan-300/20 bg-slate-950/60 p-3 text-xs text-slate-100">
            {(profile?.future_plans_md || "") + "\n\n" + (profile?.strategy_md || "")}
          </pre>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-4">
          <h2 className="text-lg font-black">Physical · Wardrobe · Beauty</h2>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-cyan-100">Physical DNA</h3>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-cyan-300/20 bg-slate-950/60 p-3 text-xs text-slate-100">
            {prettyJson(profile?.physical ?? {})}
          </pre>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-cyan-100">Wardrobe Prompts</h3>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-cyan-300/20 bg-slate-950/60 p-3 text-xs text-slate-100">
            {prettyJson(profile?.wardrobe ?? {})}
          </pre>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-cyan-100">Beauty Prompts (Hair, Nails, Makeup)</h3>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-cyan-300/20 bg-slate-950/60 p-3 text-xs text-slate-100">
            {prettyJson(profile?.beauty ?? {})}
          </pre>
        </article>

        <article className="panel p-4">
          <h2 className="text-lg font-black">World Context & Carousel Rules</h2>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-cyan-100">World / Events</h3>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-cyan-300/20 bg-slate-950/60 p-3 text-xs text-slate-100">
            {prettyJson(profile?.world ?? {})}
          </pre>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-cyan-100">Carousel Prompt Rules</h3>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-cyan-300/20 bg-slate-950/60 p-3 text-xs text-slate-100">
            {prettyJson(profile?.carousel_rules ?? {})}
          </pre>
        </article>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">Calendar Archive</h2>
        {calendarArchive.length === 0 ? (
          <p className="mt-2 rounded-lg border border-cyan-300/20 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
            No saved months yet. Generate from dashboard first.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
            >
              <option value="">Select month</option>
              {calendarArchive.map((entry) => (
                <option key={entry.id} value={monthKey(entry.year, entry.month)}>
                  {entry.year}-{String(entry.month).padStart(2, "0")} · {entry.mode.toUpperCase()} · {entry.days_count} days
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const [selectedYear, selectedMonth] = selectedMonthKey.split("-").map(Number);
                if (selectedYear && selectedMonth) {
                  void loadMonth(selectedYear, selectedMonth);
                }
              }}
              disabled={!selectedMonthKey || busyLoadMonth}
              className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"
            >
              {busyLoadMonth ? "Loading..." : "Load Month"}
            </button>
          </div>
        )}
      </section>

      {loadedMonth ? (
        <section className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-black">
              Loaded Calendar {loadedMonth.year}-{String(loadedMonth.month).padStart(2, "0")}
            </h2>
            <span className="rounded-md border border-cyan-300/40 px-2 py-1 text-xs font-bold text-cyan-100">
              {loadedMonth.mode.toUpperCase()}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {loadedMonth.days.slice(0, 10).map((day) => (
              <article key={day.day} className="rounded-lg border border-cyan-300/20 bg-slate-950/50 p-3">
                <p className="font-semibold">Day {day.day}: {day.theme} ({day.mood})</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-100">
                  {day.posts.slice(0, 2).map((post) => (
                    <li key={post.post_number}>[{post.time}] {post.scene_type} - {post.caption}</li>
                  ))}
                </ul>
                {day.posts[0]?.slides?.length ? (
                  <p className="mt-2 text-xs text-cyan-100/90">
                    Carousel ready: {day.posts[0].slides.length} slide prompts per post.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    </main>
  );
}
