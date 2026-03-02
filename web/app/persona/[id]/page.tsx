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

type PersonaTab = "overview" | "narrative" | "style" | "world" | "calendar" | "media";

const TAB_OPTIONS: Array<{ id: PersonaTab; label: string; marker: string }> = [
  { id: "overview", label: "Overview", marker: "ID" },
  { id: "narrative", label: "Narrative", marker: "ST" },
  { id: "style", label: "Style DNA", marker: "DN" },
  { id: "world", label: "World", marker: "EV" },
  { id: "calendar", label: "Calendar", marker: "CL" },
  { id: "media", label: "Media Studio", marker: "MD" }
];

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

function badgeTone(status: string): string {
  if (status === "completed") return "border-emerald-300/40 bg-emerald-500/15 text-emerald-100";
  if (status === "failed") return "border-rose-300/40 bg-rose-500/15 text-rose-100";
  return "border-slate-300/35 bg-slate-700/30 text-slate-100";
}

type CollapsibleBlockProps = {
  title: string;
  subtitle: string;
  content: string;
  onCopy: () => void;
  defaultOpen?: boolean;
};

function CollapsibleBlock({ title, subtitle, content, onCopy, defaultOpen = false }: CollapsibleBlockProps) {
  return (
    <details className="subpanel p-3" open={defaultOpen}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-label">{subtitle}</p>
            <h3 className="mt-1 text-base font-bold text-slate-100">{title}</h3>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onCopy();
            }}
            className="copy-btn"
          >
            Copy
          </button>
        </div>
      </summary>
      <pre className="data-scroll mt-3 whitespace-pre-wrap text-xs text-slate-100">{content}</pre>
    </details>
  );
}

export default function PersonaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const personaId = params.id;

  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;

  const [detail, setDetail] = useState<PersonaDetail | null>(null);
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [activeTab, setActiveTab] = useState<PersonaTab>("overview");
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
  const [regenerateStartedAt, setRegenerateStartedAt] = useState<number | null>(null);
  const [regenerateElapsedSec, setRegenerateElapsedSec] = useState(0);
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

  const hasCalendarSource = postOptions.length > 0;

  useEffect(() => {
    if (!busyRegenerate || !regenerateStartedAt) {
      setRegenerateElapsedSec(0);
      return;
    }

    const timer = window.setInterval(() => {
      setRegenerateElapsedSec(Math.max(0, Math.floor((Date.now() - regenerateStartedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [busyRegenerate, regenerateStartedAt]);

  useEffect(() => {
    if (mediaMode === "image") {
      setSelectedSourceMediaId("");
    }
  }, [mediaMode]);

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
      } else {
        setSelectedPostId("");
        setSelectedSlidePrompt("");
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
      setRegenerateStartedAt(Date.now());
      setError("");
      setSuccess("Generating profile. This can take up to 2-4 minutes depending on model load.");

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
      setRegenerateStartedAt(null);
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
    if (!hasCalendarSource) {
      setError("Load a saved calendar first in the Calendar tab before generating media.");
      return;
    }
    if (!selectedPostId) {
      setError("Select a calendar post first.");
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

      setSuccess(`Media job queued (${job.mode.toUpperCase()}). Status will update in the list below.`);
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
      setSuccess("Copied to clipboard.");
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
    return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">Loading persona workspace...</main>;
  }

  if (!detail) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">
        <p className="rounded-lg border border-rose-300/40 bg-rose-500/10 p-3 text-sm text-rose-100">Persona not found.</p>
      </main>
    );
  }

  const profile = detail.profile;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-7">
      <section className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300/35 bg-slate-900/70 text-xl font-black text-slate-100">
              {detail.persona.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="section-label">Vidra by Lexa AI · Persona Workspace</p>
              <h1 className="mt-1 text-2xl font-black sm:text-4xl">{detail.persona.name}</h1>
              <p className="text-sm text-slate-300">
                @{detail.persona.handle} · {detail.persona.city} · {detail.persona.niche}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="copy-btn inline-flex items-center justify-center px-3 py-2 text-xs">
              Back to Dashboard
            </Link>
            <Link href="/settings" className="copy-btn inline-flex items-center justify-center px-3 py-2 text-xs">
              Settings
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <article className="subpanel p-3">
            <p className="section-label">Tier</p>
            <p className="mt-1 text-xl font-black">{myPlan?.current_tier?.toUpperCase() ?? "FREE"}</p>
          </article>
          <article className="subpanel p-3">
            <p className="section-label">Profile Mode</p>
            <p className="mt-1 text-xl font-black">{profile?.generated_mode?.toUpperCase() ?? "OFFLINE"}</p>
          </article>
          <article className="subpanel p-3">
            <p className="section-label">Saved Calendars</p>
            <p className="mt-1 text-xl font-black">{calendarArchive.length}</p>
          </article>
          <article className="subpanel p-3">
            <p className="section-label">Media Jobs</p>
            <p className="mt-1 text-xl font-black">{detail.media_generated_count}</p>
          </article>
          <article className="subpanel p-3">
            <p className="section-label">Credits</p>
            <p className="mt-1 text-xl font-black">{myPlan?.credits_balance ?? 0}</p>
          </article>
        </div>

        {myPlan?.openrouter_model ? (
          <p className="mt-3 rounded-lg border border-sky-300/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
            Active paid model: <span className="font-bold">{myPlan.openrouter_model}</span>
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-4">
          <p className="section-label">Operations</p>
          <h2 className="mt-1 text-xl font-black">Profile Control</h2>
          <p className="mt-1 text-xs text-slate-300">
            Regenerate profile when persona identity changes. Auto uses paid model for PRO/MAX if configured.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => regenerateProfile("auto")}
              disabled={busyRegenerate !== null}
              className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {busyRegenerate === "auto" ? "Generating..." : "Regenerate (Auto)"}
            </button>
            <button
              type="button"
              onClick={() => regenerateProfile("offline")}
              disabled={busyRegenerate !== null}
              className="copy-btn px-4 py-2 text-sm disabled:opacity-50"
            >
              {busyRegenerate === "offline" ? "Generating..." : "Force Offline"}
            </button>
            <button
              type="button"
              onClick={() => regenerateProfile("llm")}
              disabled={busyRegenerate !== null}
              className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100 disabled:opacity-50"
            >
              {busyRegenerate === "llm" ? "Generating..." : "Force LLM"}
            </button>
          </div>

          {busyRegenerate ? (
            <p className="mt-3 rounded-lg border border-sky-300/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
              Generation in progress ({regenerateElapsedSec}s). Keep this tab open; avoid redeploying during generation.
            </p>
          ) : null}

          <button
            type="button"
            onClick={deletePersona}
            disabled={busyDelete}
            className="mt-3 rounded-lg border border-rose-300/40 px-4 py-2 text-sm font-bold text-rose-100 disabled:opacity-50"
          >
            {busyDelete ? "Deleting..." : "Delete Persona"}
          </button>
        </article>

        <article className="panel p-4">
          <p className="section-label">Data Wiring</p>
          <h2 className="mt-1 text-xl font-black">Consistency Check</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-100">
            <li className="subpanel px-3 py-2">
              Persona auto-generation uses: <span className="font-semibold">name, age, city, niche, vibe</span>.
            </li>
            <li className="subpanel px-3 py-2">
              Media Studio prompt source: <span className="font-semibold">loaded calendar post/slide prompts</span>.
            </li>
            <li className="subpanel px-3 py-2">
              Current calendar source: <span className="font-semibold">{loadedMonth ? `${loadedMonth.year}-${String(loadedMonth.month).padStart(2, "0")}` : "none loaded"}</span>.
            </li>
            <li className="subpanel px-3 py-2">
              If no calendar is loaded, media generation is blocked with guidance instead of generic prompts.
            </li>
          </ul>
        </article>
      </section>

      <section className="panel p-3">
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pill-btn ${activeTab === tab.id ? "pill-btn-active" : ""}`}
            >
              <span className="mr-1 rounded-md border border-slate-400/35 bg-slate-700/40 px-1.5 py-0.5 text-[10px]">{tab.marker}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "overview" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel p-4">
            <p className="section-label">Identity</p>
            <h2 className="mt-1 text-lg font-black">Persona Snapshot</h2>
            <dl className="mt-3 grid gap-2 text-sm text-slate-100 sm:grid-cols-2">
              <div className="subpanel p-2">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt>
                <dd className="font-semibold">{detail.persona.name}</dd>
              </div>
              <div className="subpanel p-2">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Handle</dt>
                <dd className="font-semibold">@{detail.persona.handle}</dd>
              </div>
              <div className="subpanel p-2">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Age</dt>
                <dd className="font-semibold">{detail.persona.age}</dd>
              </div>
              <div className="subpanel p-2">
                <dt className="text-xs uppercase tracking-wide text-slate-400">City</dt>
                <dd className="font-semibold">{detail.persona.city}</dd>
              </div>
              <div className="subpanel p-2 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Niche · Vibe</dt>
                <dd className="font-semibold">
                  {detail.persona.niche} · {detail.persona.vibe}
                </dd>
              </div>
            </dl>
          </article>

          <article className="panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="section-label">Positioning</p>
                <h2 className="mt-1 text-lg font-black">Bio</h2>
              </div>
              <button type="button" onClick={() => void copyPrompt(profile?.bio || "")} className="copy-btn">
                Copy
              </button>
            </div>
            <pre className="data-scroll mt-3 whitespace-pre-wrap text-sm text-slate-100">{profile?.bio || "No bio generated yet."}</pre>
          </article>

          <article className="panel p-4 lg:col-span-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="section-label">Prompt System</p>
                <h2 className="mt-1 text-lg font-black">Master Image Prompt Blueprint</h2>
              </div>
              <button type="button" onClick={() => void copyPrompt(profile?.prompt_blueprint || "")} className="copy-btn">
                Copy Prompt
              </button>
            </div>
            <pre className="data-scroll mt-3 whitespace-pre-wrap text-xs text-slate-100">
              {profile?.prompt_blueprint || "No prompt blueprint yet."}
            </pre>
          </article>
        </section>
      ) : null}

      {activeTab === "narrative" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <CollapsibleBlock
            title="Backstory"
            subtitle="Narrative Arc"
            content={profile?.backstory_md || "No backstory yet."}
            onCopy={() => void copyPrompt(profile?.backstory_md || "")}
            defaultOpen
          />
          <CollapsibleBlock
            title="Future Plans & Strategy"
            subtitle="Forward Plan"
            content={`${profile?.future_plans_md || ""}\n\n${profile?.strategy_md || ""}`.trim() || "No strategy yet."}
            onCopy={() => void copyPrompt(`${profile?.future_plans_md || ""}\n\n${profile?.strategy_md || ""}`.trim())}
            defaultOpen
          />
        </section>
      ) : null}

      {activeTab === "style" ? (
        <section className="grid gap-4">
          <CollapsibleBlock
            title="Physical DNA"
            subtitle="Style Core"
            content={prettyJson(profile?.physical ?? {})}
            onCopy={() => void copyPrompt(prettyJson(profile?.physical ?? {}))}
            defaultOpen
          />
          <CollapsibleBlock
            title="Wardrobe Prompt Library"
            subtitle="Outfit Engine"
            content={prettyJson(profile?.wardrobe ?? {})}
            onCopy={() => void copyPrompt(prettyJson(profile?.wardrobe ?? {}))}
            defaultOpen
          />
          <CollapsibleBlock
            title="Beauty Prompt Library"
            subtitle="Hair · Nails · Makeup"
            content={prettyJson(profile?.beauty ?? {})}
            onCopy={() => void copyPrompt(prettyJson(profile?.beauty ?? {}))}
            defaultOpen
          />
        </section>
      ) : null}

      {activeTab === "world" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <CollapsibleBlock
            title="World Context & Events"
            subtitle="External Story Hooks"
            content={prettyJson(profile?.world ?? {})}
            onCopy={() => void copyPrompt(prettyJson(profile?.world ?? {}))}
            defaultOpen
          />
          <CollapsibleBlock
            title="Carousel Rules"
            subtitle="Slide Consistency"
            content={prettyJson(profile?.carousel_rules ?? {})}
            onCopy={() => void copyPrompt(prettyJson(profile?.carousel_rules ?? {}))}
            defaultOpen
          />
        </section>
      ) : null}

      {activeTab === "calendar" ? (
        <section className="grid gap-4">
          <article className="panel p-4">
            <h2 className="text-lg font-black">Calendar Archive</h2>
            {calendarArchive.length === 0 ? (
              <p className="mt-2 subpanel px-3 py-2 text-sm text-slate-300">No saved months yet. Generate from dashboard first.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select
                  className="w-full rounded-lg border border-slate-400/35 bg-slate-950/70 px-3 py-2"
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
                  className="copy-btn px-4 py-2 text-sm disabled:opacity-50"
                >
                  {busyLoadMonth ? "Loading..." : "Load Month"}
                </button>
              </div>
            )}
          </article>

          {loadedMonth ? (
            <article className="panel p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-black">
                  Loaded Calendar {loadedMonth.year}-{String(loadedMonth.month).padStart(2, "0")}
                </h2>
                <span className="rounded-md border border-slate-300/40 bg-slate-700/30 px-2 py-1 text-xs font-bold text-slate-100">
                  {loadedMonth.mode.toUpperCase()}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {loadedMonth.days.slice(0, 10).map((day) => (
                  <details key={day.day} className="subpanel p-3">
                    <summary className="cursor-pointer list-none">
                      <p className="font-semibold text-slate-100">
                        Day {day.day}: {day.theme} ({day.mood})
                      </p>
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-slate-100">
                      {day.posts.slice(0, 3).map((post) => (
                        <li key={post.id} className="subpanel px-2 py-1">
                          [{post.time}] {post.scene_type} · {post.caption}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {activeTab === "media" ? (
        <section className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black">Media Studio</h2>
              <p className="mt-1 text-xs text-slate-300">
                Prompts are sourced from loaded calendar posts and slides for persona consistency.
              </p>
            </div>
            <span className={`rounded-md border px-2 py-1 text-xs font-bold ${hasCalendarSource ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-amber-300/40 bg-amber-500/10 text-amber-100"}`}>
              {hasCalendarSource ? "Calendar source ready" : "Load calendar first"}
            </span>
          </div>

          {!hasCalendarSource ? (
            <p className="mt-3 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              No calendar data loaded. Open the Calendar tab, load a saved month, then return here.
            </p>
          ) : null}

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <article className="subpanel p-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-100">Generation Panel</h3>

              <div className="mt-2 space-y-2">
                <select
                  className="w-full rounded-lg border border-slate-400/35 bg-slate-950/70 px-3 py-2"
                  value={selectedPostId}
                  onChange={(e) => onSelectPost(e.target.value)}
                  disabled={!hasCalendarSource}
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
                        className="copy-btn"
                      >
                        Slide {slide.slide_number}
                      </button>
                    )) : (
                      <button
                        type="button"
                        onClick={() => onSelectSlidePrompt(selectedPost.prompt)}
                        className="copy-btn"
                      >
                        Use Post Prompt
                      </button>
                    )}
                  </div>
                ) : null}

                <textarea
                  className="min-h-36 w-full rounded-lg border border-slate-400/35 bg-slate-950/70 px-3 py-2 text-xs text-slate-100"
                  value={selectedSlidePrompt}
                  onChange={(e) => setSelectedSlidePrompt(e.target.value)}
                  placeholder="Prompt for image generation"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaMode("image")}
                    className={`pill-btn ${mediaMode === "image" ? "pill-btn-active" : ""}`}
                  >
                    New Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode("edit")}
                    className={`pill-btn ${mediaMode === "edit" ? "pill-btn-active" : ""}`}
                  >
                    Edit Existing Image
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyPrompt(selectedSlidePrompt)}
                    className="copy-btn"
                  >
                    Copy Prompt
                  </button>
                </div>

                {mediaMode === "edit" ? (
                  <select
                    className="w-full rounded-lg border border-slate-400/35 bg-slate-950/70 px-3 py-2"
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
                  disabled={busyMedia || !hasCalendarSource}
                  className="w-full rounded-lg bg-sky-400 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  {busyMedia ? "Processing..." : mediaMode === "image" ? "Generate Image" : "Generate Edit"}
                </button>
              </div>
            </article>

            <article className="subpanel p-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-100">Media Jobs</h3>
              <div className="mt-2 max-h-[33rem] space-y-2 overflow-auto pr-1">
                {mediaJobs.length === 0 ? (
                  <p className="text-xs text-slate-300">No media generated yet.</p>
                ) : (
                  mediaJobs.map((job) => (
                    <div key={job.id} className="subpanel p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-md border px-2 py-0.5 font-bold ${badgeTone(job.status)}`}>
                          {job.mode.toUpperCase()} · {job.status.toUpperCase()}
                        </span>
                        <p className="text-slate-300">-{job.cost_credits} credits</p>
                      </div>
                      <p className="mt-1 text-slate-300">{new Date(job.created_at).toLocaleString()}</p>
                      <p className="mt-1 line-clamp-3 text-slate-100">{job.prompt}</p>
                      {job.output_url ? (
                        <a href={job.output_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sky-200 underline">
                          Open Output
                        </a>
                      ) : null}
                      {job.error_message ? <p className="mt-1 text-rose-200">{job.error_message}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {success ? <p className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 p-3 text-sm text-emerald-100">{success}</p> : null}
      {error ? <p className="rounded-lg border border-rose-300/35 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</p> : null}
    </main>
  );
}
