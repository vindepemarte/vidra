"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  gender: "male" | "female";
  template: string;
};

type PersonaProfileStatus = {
  generation_status: "empty" | "queued" | "generating" | "ready" | "failed";
  generation_requested_mode?: string | null;
  generation_effective_mode?: string | null;
  generation_model_used?: string | null;
  generation_step?: string | null;
  progress_percent?: number;
  elapsed_seconds?: number;
  estimated_total_seconds?: number | null;
  eta_seconds?: number | null;
  can_retry?: boolean;
  is_terminal?: boolean;
  next_poll_seconds?: number;
  generation_error?: string | null;
  generation_started_at?: string | null;
  generation_completed_at?: string | null;
  generation_run_id?: string | null;
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
  profile_status?: PersonaProfileStatus | null;
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

type ItemCard = {
  title: string;
  subtitle?: string;
  content: string;
};

const TAB_OPTIONS: Array<{ id: PersonaTab; label: string; marker: string }> = [
  { id: "overview", label: "Overview", marker: "ID" },
  { id: "narrative", label: "Narrative", marker: "ST" },
  { id: "style", label: "Style DNA", marker: "DN" },
  { id: "world", label: "World", marker: "EV" },
  { id: "calendar", label: "Calendar", marker: "CL" },
  { id: "media", label: "Media Studio", marker: "MD" }
];

const ICON_MAP: Record<string, string> = {
  physical: "[DNA]",
  wardrobe: "[WRD]",
  beauty: "[BTY]",
  grooming: "[GRM]",
  hairstyles: "[HAR]",
  makeup: "[MKP]",
  nails: "[NLS]",
  skincare: "[SKN]",
  world: "[WRL]",
  events: "[EVT]",
  carousel: "[CAR]",
  tops: "[TOP]",
  bottoms: "[BTM]",
  dresses: "[DRS]",
  shirts: "[SHT]",
  trousers: "[TRS]",
  suits: "[SUT]",
  shoes: "[SHO]",
  accessories: "[ACC]"
};

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function profileStatusLabel(status?: string): string {
  if (status === "ready") return "Ready";
  if (status === "queued") return "Queued";
  if (status === "generating") return "Generating";
  if (status === "failed") return "Failed";
  return "Empty";
}

function profileStatusTone(status?: string): string {
  if (status === "ready") return "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
  if (status === "failed") return "border-rose-300/35 bg-rose-500/10 text-rose-100";
  if (status === "queued" || status === "generating") return "border-amber-300/35 bg-amber-500/10 text-amber-100";
  return "border-slate-300/30 bg-slate-700/20 text-slate-100";
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toItemCards(value: unknown): ItemCard[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item, idx) => {
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const title = typeof row.name === "string" ? row.name : `Item ${idx + 1}`;
        const snippet = typeof row.prompt_snippet === "string" ? row.prompt_snippet : prettyJson(row);
        const subtitle = typeof row.id === "string" ? row.id : undefined;
        return { title, subtitle, content: snippet };
      }
      return { title: `Item ${idx + 1}`, content: String(item) };
    });
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, content]) => ({
      title: key.replace(/_/g, " "),
      content: typeof content === "string" ? content : prettyJson(content)
    }));
  }

  return [{ title: "Value", content: String(value) }];
}

async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const payload = JSON.parse(text) as { detail?: string | { message?: string; code?: string; status?: string } };
    if (typeof payload.detail === "string" && payload.detail) {
      return payload.detail;
    }
    if (payload.detail && typeof payload.detail === "object") {
      if (payload.detail.message) return payload.detail.message;
      if (payload.detail.code) return payload.detail.code;
      if (payload.detail.status) return payload.detail.status;
    }
  } catch {
    // no-op
  }
  return text || `Request failed (${res.status})`;
}

type CollapsibleSectionProps = {
  icon?: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function CollapsibleSection({ icon = "[*]", title, subtitle, children, defaultOpen = false }: CollapsibleSectionProps) {
  return (
    <details className="subpanel p-3" open={defaultOpen}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{icon}</span>
            <div>
              <p className="section-label">{subtitle || "Section"}</p>
              <h3 className="text-base font-bold text-slate-100">{title}</h3>
            </div>
          </div>
          <span className="text-[10px] text-slate-300">toggle</span>
        </div>
      </summary>
      <div className="mt-3">{children}</div>
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
  const [profileStatus, setProfileStatus] = useState<PersonaProfileStatus | null>(null);

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
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyMedia, setBusyMedia] = useState(false);
  const [pollingProfile, setPollingProfile] = useState(false);
  const [statusElapsedSec, setStatusElapsedSec] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const autoGenerationTriggeredRef = useRef(false);

  const calendarArchive = useMemo(() => detail?.calendars ?? [], [detail?.calendars]);
  const profile = detail?.profile;
  const isProfileReady = profileStatus?.generation_status === "ready";

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

  const activeMonthLabel = loadedMonth ? `${loadedMonth.year}-${String(loadedMonth.month).padStart(2, "0")}` : "none";

  useEffect(() => {
    if (!pollingProfile || !profileStatus?.generation_started_at) {
      setStatusElapsedSec(0);
      return;
    }
    const startedAt = new Date(profileStatus.generation_started_at).getTime();
    if (!startedAt) return;

    const timer = window.setInterval(() => {
      setStatusElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pollingProfile, profileStatus?.generation_started_at]);

  useEffect(() => {
    if (mediaMode === "image") {
      setSelectedSourceMediaId("");
    }
  }, [mediaMode]);

  useEffect(() => {
    autoGenerationTriggeredRef.current = false;
  }, [personaId]);

  async function loadMediaJobs(): Promise<void> {
    if (!token || !personaId) return;
    const res = await fetch(`${API_URL}/api/media/persona/${personaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res));
    const payload = (await res.json()) as MediaList;
    setMediaJobs(payload.jobs || []);
  }

  async function loadProfileStatus(): Promise<PersonaProfileStatus | null> {
    if (!token || !personaId) return null;
    const res = await fetch(`${API_URL}/api/personas/${personaId}/profile/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as PersonaProfileStatus;
    setProfileStatus(payload);
    return payload;
  }

  async function pollProfileUntilTerminal(maxAttempts = 5400): Promise<PersonaProfileStatus | null> {
    setPollingProfile(true);
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const payload = await loadProfileStatus();
        if (!payload) return null;
        if (payload.is_terminal || payload.generation_status === "ready" || payload.generation_status === "failed") {
          return payload;
        }
        await sleep((payload.next_poll_seconds ?? 2) * 1000);
      }
      return null;
    } finally {
      setPollingProfile(false);
    }
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
      setProfileStatus(detailPayload.profile_status ?? null);

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

  async function startProfileGeneration(mode: "auto" | "offline" | "llm", autoSilent = false): Promise<void> {
    if (!token || !personaId || busyRegenerate) return;

    try {
      setBusyRegenerate(mode);
      setError("");
      if (!autoSilent) {
        setSuccess("Profile generation started. You can stay on this page while status updates.");
      }

      const res = await fetch(`${API_URL}/api/personas/${personaId}/profile/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));
      const initialStatus = (await res.json()) as PersonaProfileStatus;
      setProfileStatus(initialStatus);

      const finalStatus = await pollProfileUntilTerminal();
      if (finalStatus?.generation_status === "ready") {
        setSuccess("Profile ready. Calendar and Media Studio are now unlocked.");
        await loadPersonaDetail(false);
      } else if (finalStatus?.generation_status === "failed") {
        setError(finalStatus.generation_error || "Profile generation failed.");
      }
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
    if (!isProfileReady) {
      setError("Profile is not ready. Complete profile generation first.");
      return;
    }
    if (!loadedMonth) {
      setError("Choose and load a calendar month before media generation.");
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

      setSuccess(`Media job queued (${job.mode.toUpperCase()}). Status will update below.`);
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

  useEffect(() => {
    if (!token || !personaId || !profileStatus) return;
    if (busyRegenerate !== null) return;
    if (profileStatus.generation_status === "ready") {
      autoGenerationTriggeredRef.current = false;
      return;
    }

    if (profileStatus.generation_status === "queued" || profileStatus.generation_status === "generating") {
      void pollProfileUntilTerminal().then(async (finalStatus) => {
        if (finalStatus?.generation_status === "ready") {
          await loadPersonaDetail(false);
        }
      });
      return;
    }

    if (profileStatus.generation_status === "empty" || profileStatus.generation_status === "failed") {
      if (autoGenerationTriggeredRef.current) return;
      autoGenerationTriggeredRef.current = true;
      void startProfileGeneration("auto", true);
    }
  }, [token, personaId, profileStatus?.generation_status, busyRegenerate]);

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

  const canUseOperationalTabs = isProfileReady;

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
            <p className="mt-1 text-xl font-black">
              {(profileStatus?.generation_effective_mode || profile?.generated_mode || "pending").toUpperCase()}
            </p>
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
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-4">
          <p className="section-label">Profile Build Stage</p>
          <h2 className="mt-1 text-xl font-black">Generation Status</h2>

          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${profileStatusTone(profileStatus?.generation_status)}`}>
            Status: <span className="font-bold">{profileStatusLabel(profileStatus?.generation_status)}</span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/70">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all duration-500"
              style={{ width: `${Math.max(3, Math.min(100, profileStatus?.progress_percent ?? 0))}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-300">
            {profileStatus?.generation_step || "Waiting to start"}
          </p>

          <div className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
            <p className="subpanel px-3 py-2">Requested mode: {profileStatus?.generation_requested_mode?.toUpperCase() || "AUTO"}</p>
            <p className="subpanel px-3 py-2">Effective mode: {profileStatus?.generation_effective_mode?.toUpperCase() || "PENDING"}</p>
            <p className="subpanel px-3 py-2">Model: {profileStatus?.generation_model_used || "Pending"}</p>
            <p className="subpanel px-3 py-2">
              Elapsed: {Math.max(statusElapsedSec, profileStatus?.elapsed_seconds ?? 0)}s
              {typeof profileStatus?.eta_seconds === "number" ? ` · ETA ${profileStatus.eta_seconds}s` : ""}
            </p>
          </div>

          {profileStatus?.generation_error ? (
            <p className="mt-2 rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {profileStatus.generation_error}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startProfileGeneration("auto")}
              disabled={busyRegenerate !== null}
              className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {busyRegenerate === "auto" ? "Starting..." : "Build / Retry (Auto)"}
            </button>
            <button
              type="button"
              onClick={() => void startProfileGeneration("offline")}
              disabled={busyRegenerate !== null}
              className="copy-btn px-4 py-2 text-sm disabled:opacity-50"
            >
              {busyRegenerate === "offline" ? "Starting..." : "Force Offline"}
            </button>
            <button
              type="button"
              onClick={() => void startProfileGeneration("llm")}
              disabled={busyRegenerate !== null}
              className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100 disabled:opacity-50"
            >
              {busyRegenerate === "llm" ? "Starting..." : "Force LLM"}
            </button>
          </div>
        </article>

        <article className="panel p-4">
          <p className="section-label">Identity</p>
          <h2 className="mt-1 text-xl font-black">Persona Snapshot</h2>
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
              <dt className="text-xs uppercase tracking-wide text-slate-400">Gender</dt>
              <dd className="font-semibold">{detail.persona.gender.toUpperCase()}</dd>
            </div>
            <div className="subpanel p-2 sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Niche · Vibe</dt>
              <dd className="font-semibold">
                {detail.persona.niche} · {detail.persona.vibe}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={deletePersona}
            disabled={busyDelete}
            className="mt-3 rounded-lg border border-rose-300/40 px-4 py-2 text-sm font-bold text-rose-100 disabled:opacity-50"
          >
            {busyDelete ? "Deleting..." : "Delete Persona"}
          </button>
        </article>
      </section>

      <section className="panel p-3">
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((tab) => {
            const disabled = (tab.id === "calendar" || tab.id === "media") && !canUseOperationalTabs;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                disabled={disabled}
                className={`pill-btn ${activeTab === tab.id ? "pill-btn-active" : ""} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="mr-1 rounded-md border border-slate-400/35 bg-slate-700/40 px-1.5 py-0.5 text-[10px]">{tab.marker}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {!canUseOperationalTabs ? (
          <p className="mt-3 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Calendar and Media Studio unlock only when profile status is READY.
          </p>
        ) : null}
      </section>

      {activeTab === "overview" ? (
        <section className="grid gap-4 lg:grid-cols-2">
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

          <article className="panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="section-label">Prompt System</p>
                <h2 className="mt-1 text-lg font-black">Master Image Prompt Blueprint</h2>
              </div>
              <button type="button" onClick={() => void copyPrompt(profile?.prompt_blueprint || "")} className="copy-btn">
                Copy
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
          <CollapsibleSection icon="[ST]" title="Backstory" subtitle="Narrative Arc" defaultOpen>
            <div className="flex justify-end">
              <button type="button" onClick={() => void copyPrompt(profile?.backstory_md || "")} className="copy-btn">
                Copy
              </button>
            </div>
            <pre className="data-scroll mt-2 whitespace-pre-wrap text-xs text-slate-100">{profile?.backstory_md || "No backstory yet."}</pre>
          </CollapsibleSection>

          <CollapsibleSection icon="[PLN]" title="Future Plans & Strategy" subtitle="Execution Map" defaultOpen>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void copyPrompt(`${profile?.future_plans_md || ""}\n\n${profile?.strategy_md || ""}`.trim())}
                className="copy-btn"
              >
                Copy
              </button>
            </div>
            <pre className="data-scroll mt-2 whitespace-pre-wrap text-xs text-slate-100">
              {`${profile?.future_plans_md || ""}\n\n${profile?.strategy_md || ""}`.trim() || "No strategy yet."}
            </pre>
          </CollapsibleSection>
        </section>
      ) : null}

      {activeTab === "style" ? (
        <section className="grid gap-4">
          <CollapsibleSection icon={ICON_MAP.physical} title="Physical DNA" subtitle="Identity Lock" defaultOpen>
            <div className="grid gap-2 sm:grid-cols-2">
              {toItemCards(profile?.physical ?? {}).map((card) => (
                <article key={card.title} className="subpanel p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-100">{card.title}</p>
                      {card.subtitle ? <p className="text-[10px] text-slate-400">{card.subtitle}</p> : null}
                    </div>
                    <button type="button" className="copy-btn" onClick={() => void copyPrompt(card.content)}>
                      Copy
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-200">{card.content}</p>
                </article>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection icon={ICON_MAP.wardrobe} title="Wardrobe Prompt Library" subtitle="Outfit Engine" defaultOpen>
            <div className="grid gap-3">
              {Object.entries((profile?.wardrobe ?? {}) as Record<string, unknown>).map(([category, rows]) => (
                <CollapsibleSection
                  key={category}
                  icon={ICON_MAP[category] || "[CAT]"}
                  title={category.replace(/_/g, " ").toUpperCase()}
                  subtitle="Category"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {toItemCards(rows).map((item) => (
                      <article key={`${category}-${item.title}-${item.content.slice(0, 12)}`} className="subpanel p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-100">{item.title}</p>
                            {item.subtitle ? <p className="text-[10px] text-slate-400">{item.subtitle}</p> : null}
                          </div>
                          <button type="button" className="copy-btn" onClick={() => void copyPrompt(item.content)}>
                            Copy
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-200">{item.content}</p>
                      </article>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            icon={ICON_MAP[detail.persona.gender === "female" ? "beauty" : "grooming"] || "[BTY]"}
            title={detail.persona.gender === "female" ? "Beauty Prompt Library" : "Grooming Prompt Library"}
            subtitle={detail.persona.gender === "female" ? "Hair · Makeup · Nails" : "Hair · Grooming · Skin"}
            defaultOpen
          >
            <div className="grid gap-3">
              {Object.entries((profile?.beauty ?? {}) as Record<string, unknown>).map(([category, rows]) => (
                <CollapsibleSection
                  key={category}
                  icon={ICON_MAP[category] || "[CAT]"}
                  title={category.replace(/_/g, " ").toUpperCase()}
                  subtitle="Category"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {toItemCards(rows).map((item) => (
                      <article key={`${category}-${item.title}-${item.content.slice(0, 12)}`} className="subpanel p-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-slate-100">{item.title}</p>
                          <button type="button" className="copy-btn" onClick={() => void copyPrompt(item.content)}>
                            Copy
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-200">{item.content}</p>
                      </article>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          </CollapsibleSection>
        </section>
      ) : null}

      {activeTab === "world" ? (
        <section className="grid gap-4">
          <CollapsibleSection icon={ICON_MAP.world} title="World Context & Events" subtitle="External Story Hooks" defaultOpen>
            <div className="grid gap-2 sm:grid-cols-2">
              {toItemCards((profile?.world as Record<string, unknown>)?.events ?? []).map((eventCard, idx) => (
                <article key={`event-${idx}-${eventCard.title}`} className="subpanel p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-100">{eventCard.title}</p>
                    <button type="button" className="copy-btn" onClick={() => void copyPrompt(eventCard.content)}>
                      Copy
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-200">{eventCard.content}</p>
                </article>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection icon={ICON_MAP.carousel} title="Carousel Rules" subtitle="Slide Consistency" defaultOpen>
            <div className="grid gap-2">
              {Object.entries((profile?.carousel_rules ?? {}) as Record<string, unknown>).map(([ruleKey, ruleValue]) => (
                <article key={ruleKey} className="subpanel p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-100">{ruleKey.replace(/_/g, " ").toUpperCase()}</p>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => void copyPrompt(typeof ruleValue === "string" ? ruleValue : prettyJson(ruleValue))}
                    >
                      Copy
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-200">{typeof ruleValue === "string" ? ruleValue : prettyJson(ruleValue)}</p>
                </article>
              ))}
            </div>
          </CollapsibleSection>
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
              <p className="mt-1 text-xs text-slate-300">Prompts are sourced from selected calendar month and post slides.</p>
            </div>
            <span className="rounded-md border border-cyan-300/35 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-100">
              Month {activeMonthLabel} source active
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              className="w-full rounded-lg border border-slate-400/35 bg-slate-950/70 px-3 py-2"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
            >
              <option value="">Select source month</option>
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
              {busyLoadMonth ? "Loading..." : "Load Source Month"}
            </button>
          </div>

          {!loadedMonth ? (
            <p className="mt-3 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              You must first load a calendar month before media generation.
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
                  disabled={!loadedMonth}
                >
                  <option value="">Select post</option>
                  {postOptions.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.label}
                    </option>
                  ))}
                </select>

                {selectedPost ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedPost.slides.length > 0 ? (
                      selectedPost.slides.map((slide) => (
                        <button
                          key={`${selectedPost.id}-${slide.slide_number}`}
                          type="button"
                          onClick={() => setSelectedSlidePrompt(slide.prompt)}
                          className="copy-btn"
                        >
                          Slide {slide.slide_number}
                        </button>
                      ))
                    ) : (
                      <button type="button" onClick={() => setSelectedSlidePrompt(selectedPost.prompt)} className="copy-btn">
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
                  <button type="button" onClick={() => void copyPrompt(selectedSlidePrompt)} className="copy-btn">
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
                  disabled={busyMedia || !loadedMonth || !isProfileReady}
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
                        <span className={`rounded-md border px-2 py-0.5 font-bold ${profileStatusTone(job.status === "completed" ? "ready" : job.status === "failed" ? "failed" : "generating")}`}>
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
