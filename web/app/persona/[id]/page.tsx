"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { LogoutButton } from "@/components/logout-button";
import { API_URL } from "@/lib/api";
import { trackEvent } from "@/lib/events";

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

type MediaJobSummary = {
  id: string;
  status: string;
  mode: string;
  output_url?: string | null;
  created_at: string;
};

type PersonaDetail = {
  persona: Persona;
  profile?: PersonaProfile | null;
  calendars: CalendarMonthSummary[];
  media_generated_count: number;
  recent_media_jobs: MediaJobSummary[];
};

type CalendarSlide = {
  slide_number: number;
  prompt: string;
  edit_instruction?: string | null;
};

type CalendarPost = {
  id: string;
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
  credits_balance?: number;
  included_credits?: number;
};

type MediaJob = {
  id: string;
  user_id: string;
  persona_id: string;
  post_id?: string | null;
  provider: string;
  model: string;
  mode: string;
  status: string;
  prompt: string;
  reference_asset_id?: string | null;
  output_url?: string | null;
  error_message?: string | null;
  cost_credits: number;
  external_job_id?: string | null;
  created_at: string;
  updated_at: string;
};

type MediaList = {
  jobs: MediaJob[];
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
  const [mediaJobs, setMediaJobs] = useState<MediaJob[]>([]);

  const [selectedPostId, setSelectedPostId] = useState("");
  const [selectedSlidePrompt, setSelectedSlidePrompt] = useState("");
  const [selectedSourceMediaId, setSelectedSourceMediaId] = useState("");
  const [mediaMode, setMediaMode] = useState<"image" | "edit">("image");

  const [loading, setLoading] = useState(true);
  const [busyLoadMonth, setBusyLoadMonth] = useState(false);
  const [busyRegenerate, setBusyRegenerate] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyMedia, setBusyMedia] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const calendarArchive = useMemo(() => detail?.calendars ?? [], [detail?.calendars]);

  const postOptions = useMemo(() => {
    if (!loadedMonth) return [] as Array<{ id: string; label: string; prompt: string; slides: CalendarSlide[] }>;
    const rows: Array<{ id: string; label: string; prompt: string; slides: CalendarSlide[] }> = [];
    for (const day of loadedMonth.days) {
      for (const post of day.posts) {
        rows.push({
          id: post.id,
          label: `Day ${day.day} · Post ${post.post_number} · ${post.scene_type}`,
          prompt: post.prompt,
          slides: post.slides || []
        });
      }
    }
    return rows;
  }, [loadedMonth]);

  const selectedPost = useMemo(() => postOptions.find((post) => post.id === selectedPostId) || null, [postOptions, selectedPostId]);

  const completedMediaJobs = useMemo(
    () => mediaJobs.filter((job) => job.status === "completed" && job.output_url),
    [mediaJobs]
  );

  async function loadMediaJobs(): Promise<void> {
    if (!token || !personaId) return;
    const res = await fetch(`${API_URL}/api/media/persona/${personaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res));
    const payload = (await res.json()) as MediaList;
    setMediaJobs(payload.jobs || []);
  }

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

      await loadMediaJobs();

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

      const firstPost = payload.days[0]?.posts[0];
      if (firstPost) {
        setSelectedPostId(firstPost.id);
        setSelectedSlidePrompt(firstPost.slides?.[0]?.prompt || firstPost.prompt);
      }
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
      setSuccess("");

      const res = await fetch(`${API_URL}/api/personas/${personaId}/profile/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));
      setSuccess("Persona intelligence regenerated.");
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

  async function generateMedia(): Promise<void> {
    if (!token || !personaId || busyMedia) return;
    if (!selectedPostId) {
      setError("Select a post first.");
      return;
    }
    if (!selectedSlidePrompt.trim()) {
      setError("Prompt is empty.");
      return;
    }

    if (mediaMode === "edit" && !selectedSourceMediaId) {
      setError("Select a source image for edit mode.");
      return;
    }

    try {
      setBusyMedia(true);
      setError("");
      setSuccess("");

      const endpoint = mediaMode === "image" ? "/api/media/generate-image" : "/api/media/edit-image";
      const body: Record<string, unknown> = {
        persona_id: personaId,
        post_id: selectedPostId,
        prompt: selectedSlidePrompt
      };
      if (mediaMode === "edit") {
        body.source_media_id = selectedSourceMediaId;
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const job = (await res.json()) as MediaJob;
      await trackEvent("media_generated", { mode: mediaMode, provider: job.provider }, token);

      setSuccess(`Media job completed (${job.mode.toUpperCase()}).`);
      await loadMediaJobs();
      await loadPersonaDetail(false);

      if (job.output_url) {
        setSelectedSourceMediaId(job.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media generation failed");
    } finally {
      setBusyMedia(false);
    }
  }

  function onSelectPost(postId: string): void {
    setSelectedPostId(postId);
    const post = postOptions.find((item) => item.id === postId);
    if (!post) return;
    setSelectedSlidePrompt(post.slides[0]?.prompt || post.prompt || "");
  }

  function onSelectSlidePrompt(prompt: string): void {
    setSelectedSlidePrompt(prompt);
  }

  async function copyPrompt(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Prompt copied.");
    } catch {
      setError("Cannot copy prompt on this browser.");
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
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">Vidra by Lexa AI · Persona Control Layer</p>
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

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
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
          <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
            <p className="text-xs uppercase tracking-wide text-cyan-100/75">Media Jobs</p>
            <p className="mt-1 text-xl font-black">{detail.media_generated_count}</p>
          </article>
          <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
            <p className="text-xs uppercase tracking-wide text-cyan-100/75">Credits</p>
            <p className="mt-1 text-xl font-black">{myPlan?.credits_balance ?? 0}</p>
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
          <button
            type="button"
            onClick={() => void copyPrompt(profile?.prompt_blueprint || "")}
            className="mt-2 rounded-md border border-cyan-300/40 px-2 py-1 text-xs font-bold text-cyan-100"
          >
            Copy Master Prompt
          </button>
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

      <section className="panel p-4">
        <h2 className="text-lg font-black">Media Studio</h2>
        <p className="mt-1 text-xs text-slate-300">Generate directly from saved calendar posts. Use edit mode for coherent carousel progression.</p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <article className="rounded-lg border border-cyan-300/25 bg-slate-950/50 p-3">
            <h3 className="text-sm font-black uppercase tracking-wide text-cyan-100">Generate</h3>

            <div className="mt-2 space-y-2">
              <select
                className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                value={selectedPostId}
                onChange={(e) => onSelectPost(e.target.value)}
              >
                <option value="">Select post</option>
                {postOptions.map((post) => (
                  <option key={post.id} value={post.id}>{post.label}</option>
                ))}
              </select>

              {selectedPost ? (
                <div className="flex flex-wrap gap-2">
                  {selectedPost.slides.length > 0 ? selectedPost.slides.map((slide) => (
                    <button
                      key={`${selectedPost.id}-${slide.slide_number}`}
                      type="button"
                      onClick={() => onSelectSlidePrompt(slide.prompt)}
                      className="rounded-md border border-cyan-300/35 px-2 py-1 text-xs font-bold text-cyan-100"
                    >
                      Slide {slide.slide_number}
                    </button>
                  )) : (
                    <button
                      type="button"
                      onClick={() => onSelectSlidePrompt(selectedPost.prompt)}
                      className="rounded-md border border-cyan-300/35 px-2 py-1 text-xs font-bold text-cyan-100"
                    >
                      Use Post Prompt
                    </button>
                  )}
                </div>
              ) : null}

              <textarea
                className="min-h-36 w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2 text-xs"
                value={selectedSlidePrompt}
                onChange={(e) => setSelectedSlidePrompt(e.target.value)}
                placeholder="Prompt for image generation"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMediaMode("image")}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${mediaMode === "image" ? "border-lime-300/60 bg-lime-500/10 text-lime-100" : "border-cyan-300/30 text-cyan-100"}`}
                >
                  New Image
                </button>
                <button
                  type="button"
                  onClick={() => setMediaMode("edit")}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${mediaMode === "edit" ? "border-lime-300/60 bg-lime-500/10 text-lime-100" : "border-cyan-300/30 text-cyan-100"}`}
                >
                  Edit Existing Image
                </button>
                <button
                  type="button"
                  onClick={() => void copyPrompt(selectedSlidePrompt)}
                  className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-bold text-cyan-100"
                >
                  Copy Prompt
                </button>
              </div>

              {mediaMode === "edit" ? (
                <select
                  className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                  value={selectedSourceMediaId}
                  onChange={(e) => setSelectedSourceMediaId(e.target.value)}
                >
                  <option value="">Select source media</option>
                  {completedMediaJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {new Date(job.created_at).toLocaleString()} · {job.mode.toUpperCase()} · {job.model}
                    </option>
                  ))}
                </select>
              ) : null}

              <button
                type="button"
                onClick={generateMedia}
                disabled={busyMedia}
                className="w-full rounded-lg bg-orange-400 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {busyMedia ? "Processing..." : mediaMode === "image" ? "Generate Image" : "Generate Edit"}
              </button>
            </div>
          </article>

          <article className="rounded-lg border border-cyan-300/25 bg-slate-950/50 p-3">
            <h3 className="text-sm font-black uppercase tracking-wide text-cyan-100">Media Jobs</h3>
            <div className="mt-2 max-h-96 space-y-2 overflow-auto pr-1">
              {mediaJobs.length === 0 ? (
                <p className="text-xs text-slate-300">No media generated yet.</p>
              ) : (
                mediaJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold">{job.mode.toUpperCase()} · {job.status.toUpperCase()}</p>
                      <p className="text-slate-300">-{job.cost_credits} credits</p>
                    </div>
                    <p className="mt-1 text-slate-300">{new Date(job.created_at).toLocaleString()}</p>
                    <p className="mt-1 line-clamp-3 text-slate-100">{job.prompt}</p>
                    {job.output_url ? (
                      <a href={job.output_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-cyan-100 underline">
                        Open Output
                      </a>
                    ) : null}
                    {job.error_message ? <p className="mt-1 text-red-200">{job.error_message}</p> : null}
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>

      {success ? <p className="rounded-lg border border-lime-300/40 bg-lime-500/10 p-3 text-sm text-lime-100">{success}</p> : null}
      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    </main>
  );
}
