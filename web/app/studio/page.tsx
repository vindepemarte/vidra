"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

type CalendarMonthSummary = {
  id: string;
  month: number;
  year: number;
  mode: string;
  days_count: number;
};

type CalendarMonthList = {
  persona_id: string;
  months: CalendarMonthSummary[];
};

type MediaJob = {
  id: string;
  user_id: string;
  persona_id: string;
  post_id?: string | null;
  provider: string;
  model: string;
  mode: string;
  status: "pending" | "completed" | "failed";
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

type PersonaDetail = {
  persona: Persona;
  profile?: PersonaProfile | null;
  profile_status?: PersonaProfileStatus | null;
  calendars: CalendarMonthSummary[];
  media_generated_count: number;
  recent_media_jobs: Array<{
    id: string;
    status: string;
    mode: string;
    output_url?: string | null;
    created_at: string;
  }>;
};

type MyPlan = {
  current_tier: string;
  generation_mode: string;
  openrouter_model?: string | null;
  credits_balance?: number;
  included_credits?: number;
  personas_limit?: number;
  generation_days_per_run?: number;
};

type StudioActionSuggestion = {
  action: string;
  label: string;
  payload: Record<string, unknown>;
};

type StudioMessageResponse = {
  reply: string;
  model_used?: string | null;
  suggestions: StudioActionSuggestion[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  at: number;
  modelUsed?: string | null;
  suggestions?: StudioActionSuggestion[];
};

type PersonaForm = {
  name: string;
  handle: string;
  age: number;
  gender: "male" | "female";
  city: string;
  niche: string;
  vibe: string;
};

type MobileTab = "project" | "chat" | "preview" | "data";
type InspectorTab = "preview" | "data";

const now = new Date();

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

function statusTone(status: string | undefined): string {
  if (status === "ready" || status === "completed") return "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
  if (status === "failed") return "border-rose-300/35 bg-rose-500/10 text-rose-100";
  if (status === "queued" || status === "generating" || status === "pending") return "border-amber-300/35 bg-amber-500/10 text-amber-100";
  return "border-slate-300/30 bg-slate-700/20 text-slate-100";
}

function profileLabel(status: PersonaProfileStatus["generation_status"] | undefined): string {
  if (status === "ready") return "Ready";
  if (status === "queued") return "Queued";
  if (status === "generating") return "Generating";
  if (status === "failed") return "Failed";
  return "Empty";
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function flattenPosts(month: CalendarMonth | null): CalendarPost[] {
  if (!month) return [];
  return month.days.flatMap((d) => d.posts.map((p) => ({ ...p, caption: `${d.day.toString().padStart(2, "0")} · ${p.caption}` })));
}

function safePretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const payload = JSON.parse(text) as { detail?: string | { message?: string; code?: string; status?: string } };
    if (typeof payload.detail === "string" && payload.detail) return payload.detail;
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

function promptForSelectedPost(calendar: CalendarMonth | null, postId: string): string {
  if (!calendar || !postId) return "";
  for (const day of calendar.days) {
    const post = day.posts.find((entry) => entry.id === postId);
    if (post) return post.prompt;
  }
  return "";
}

function findCompletedImage(jobs: MediaJob[], id: string | null): MediaJob | null {
  if (!id) return null;
  return jobs.find((job) => job.id === id && job.status === "completed" && !!job.output_url) ?? null;
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

export default function StudioPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [profileStatusByPersona, setProfileStatusByPersona] = useState<Record<string, PersonaProfileStatus>>({});

  const [personaDetail, setPersonaDetail] = useState<PersonaDetail | null>(null);
  const [calendarList, setCalendarList] = useState<CalendarMonthSummary[]>([]);
  const [calendar, setCalendar] = useState<CalendarMonth | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [forceRegenerate, setForceRegenerate] = useState(true);

  const [mediaJobs, setMediaJobs] = useState<MediaJob[]>([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [mediaPrompt, setMediaPrompt] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Studio ready. Create/select a persona project, then run: profile -> calendar -> media.",
      at: Date.now(),
      suggestions: [
        { action: "create_persona", label: "Create Persona", payload: {} },
        { action: "build_profile_auto", label: "Build Profile (Auto)", payload: {} },
        { action: "generate_calendar", label: "Generate Current Month", payload: {} },
      ],
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("preview");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const [showCreatePersona, setShowCreatePersona] = useState(false);
  const [creatingPersona, setCreatingPersona] = useState(false);
  const [personaForm, setPersonaForm] = useState<PersonaForm>({
    name: "",
    handle: "",
    age: 25,
    gender: "female",
    city: "Milan",
    niche: "Fashion & Lifestyle",
    vibe: "Elegant, bold, authentic",
  });

  const [busyProfileAction, setBusyProfileAction] = useState(false);
  const [busyCalendar, setBusyCalendar] = useState(false);
  const [busyImage, setBusyImage] = useState(false);
  const [busyEdit, setBusyEdit] = useState(false);
  const [busyUpscale, setBusyUpscale] = useState(false);
  const [busyChat, setBusyChat] = useState(false);

  const chatRef = useRef<HTMLDivElement | null>(null);
  const profileTimerRef = useRef<number | null>(null);
  const mediaTimerRef = useRef<number | null>(null);
  const creditsRefreshRef = useRef<number>(0);

  const flattenedPosts = useMemo(() => flattenPosts(calendar), [calendar]);
  const selectedPost = useMemo(() => flattenedPosts.find((p) => p.id === selectedPostId) ?? null, [flattenedPosts, selectedPostId]);
  const completedMedia = useMemo(() => mediaJobs.filter((job) => job.status === "completed" && !!job.output_url), [mediaJobs]);
  const selectedMedia = useMemo(() => findCompletedImage(mediaJobs, selectedMediaId), [mediaJobs, selectedMediaId]);
  const activeProfileStatus = selectedPersonaId ? profileStatusByPersona[selectedPersonaId] : undefined;
  const profileReady = activeProfileStatus?.generation_status === "ready";

  const refreshPlanSummary = async (force = false): Promise<void> => {
    if (!token) return;
    const nowMs = Date.now();
    if (!force && nowMs - creditsRefreshRef.current < 1500) return;
    creditsRefreshRef.current = nowMs;
    try {
      const payload = await authRequest<MyPlan>("/api/plans/me");
      setPlan(payload);
    } catch {
      // Keep studio usable even if plan refresh fails transiently.
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (profileTimerRef.current) window.clearTimeout(profileTimerRef.current);
      if (mediaTimerRef.current) window.clearTimeout(mediaTimerRef.current);
    };
  }, []);

  const appendMessage = (message: Omit<ChatMessage, "id" | "at">) => {
    setMessages((prev) => [...prev, { ...message, id: crypto.randomUUID(), at: Date.now() }]);
  };

  const authRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!token) {
      throw new Error("Missing auth token");
    }
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    return (await response.json()) as T;
  };

  const loadCalendarMonths = async (personaId: string): Promise<CalendarMonthSummary[]> => {
    const payload = await authRequest<CalendarMonthList>(`/api/calendar/${personaId}/months`);
    const months = payload.months ?? [];
    setCalendarList(months);
    return months;
  };

  const loadCalendar = async (personaId: string, year: number, month: number): Promise<void> => {
    const payload = await authRequest<CalendarMonth>(`/api/calendar/${personaId}/${year}/${month}`);
    setCalendar(payload);
    const firstPost = payload.days?.[0]?.posts?.[0];
    if (firstPost) {
      setSelectedPostId(firstPost.id);
      setMediaPrompt(firstPost.prompt);
    }
  };

  const refreshMediaJobs = async (personaId: string, keepPolling = true): Promise<void> => {
    if (!personaId) return;
    const payload = await authRequest<MediaList>(`/api/media/persona/${personaId}`);
    setMediaJobs(payload.jobs ?? []);
    const selected = selectedMediaId ? payload.jobs.find((job) => job.id === selectedMediaId) : null;
    if (!selected && payload.jobs.length > 0) {
      const firstCompleted = payload.jobs.find((job) => job.status === "completed" && !!job.output_url);
      if (firstCompleted) setSelectedMediaId(firstCompleted.id);
    }

    if (!keepPolling) return;
    const hasPending = payload.jobs.some((job) => job.status === "pending");
    if (hasPending || payload.jobs.some((job) => job.status === "failed" || job.status === "completed")) {
      await refreshPlanSummary(false);
    }
    if (hasPending) {
      if (mediaTimerRef.current) window.clearTimeout(mediaTimerRef.current);
      mediaTimerRef.current = window.setTimeout(() => {
        void refreshMediaJobs(personaId, true);
      }, 2500);
    }
  };

  const refreshProfileStatus = async (personaId: string, keepPolling = true): Promise<PersonaProfileStatus | null> => {
    if (!personaId) return null;
    const previousStatus = profileStatusByPersona[personaId]?.generation_status;
    const statusPayload = await authRequest<PersonaProfileStatus>(`/api/personas/${personaId}/profile/status`);
    setProfileStatusByPersona((prev) => ({ ...prev, [personaId]: statusPayload }));

    if (keepPolling && !statusPayload.is_terminal && (statusPayload.generation_status === "queued" || statusPayload.generation_status === "generating")) {
      if (profileTimerRef.current) window.clearTimeout(profileTimerRef.current);
      const nextMs = clamp((statusPayload.next_poll_seconds ?? 2) * 1000, 1000, 8000);
      profileTimerRef.current = window.setTimeout(() => {
        void refreshProfileStatus(personaId, true);
      }, nextMs);
    }

    if (statusPayload.is_terminal && statusPayload.generation_status === "ready") {
      trackEvent("studio_profile_ready", { persona_id: personaId });
      if (previousStatus !== "ready") {
        await Promise.all([loadPersonaDetail(personaId), loadCalendarMonths(personaId)]);
      }
    }

    return statusPayload;
  };

  const loadPersonaDetail = async (personaId: string): Promise<void> => {
    const payload = await authRequest<PersonaDetail>(`/api/personas/${personaId}`);
    setPersonaDetail(payload);
    if (payload.profile_status) {
      setProfileStatusByPersona((prev) => ({ ...prev, [personaId]: payload.profile_status as PersonaProfileStatus }));
    }
  };

  const loadInitial = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [myPlanPayload, personasPayload] = await Promise.all([
        authRequest<MyPlan>("/api/plans/me"),
        authRequest<Persona[]>("/api/personas"),
      ]);
      setPlan(myPlanPayload);
      setPersonas(personasPayload);

      const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const requestedPersona = query?.get("persona");
      const firstPersona = requestedPersona && personasPayload.some((p) => p.id === requestedPersona) ? requestedPersona : personasPayload[0]?.id;
      if (firstPersona) {
        setSelectedPersonaId(firstPersona);
      } else {
        setSelectedPersonaId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load studio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  useEffect(() => {
    if (!token || !selectedPersonaId) return;
    let cancelled = false;
    const run = async () => {
      try {
        await Promise.all([loadPersonaDetail(selectedPersonaId), loadCalendarMonths(selectedPersonaId), refreshMediaJobs(selectedPersonaId, true)]);
        const profileState = await refreshProfileStatus(selectedPersonaId, true);
        if (cancelled) return;

        if (profileState?.generation_status === "ready") {
          const months = await loadCalendarMonths(selectedPersonaId);
          if (!cancelled && months.length > 0) {
            const latest = months[0];
            setCalendarMonth(latest.month);
            setCalendarYear(latest.year);
            await loadCalendar(selectedPersonaId, latest.year, latest.month);
          }
        } else {
          setCalendar(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load persona workspace");
      }
    };
    void run();

    return () => {
      cancelled = true;
      if (profileTimerRef.current) window.clearTimeout(profileTimerRef.current);
      if (mediaTimerRef.current) window.clearTimeout(mediaTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedPersonaId]);

  useEffect(() => {
    if (!selectedPersonaId) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("persona", selectedPersonaId);
    const nextUrl = `/studio?${params.toString()}`;
    window.history.replaceState({}, "", nextUrl);
  }, [selectedPersonaId, router]);

  useEffect(() => {
    if (!selectedPost) return;
    setMediaPrompt((prev) => (prev.trim().length > 0 ? prev : selectedPost.prompt));
  }, [selectedPost]);

  const createPersona = async () => {
    if (!token || creatingPersona) return;
    if (!personaForm.name.trim() || !personaForm.handle.trim()) {
      setError("Name and handle are required.");
      return;
    }
    try {
      setCreatingPersona(true);
      setError("");
      appendMessage({ role: "assistant", text: "Creating persona project and queueing profile build..." });
      const payload = await authRequest<Persona>("/api/personas", {
        method: "POST",
        body: JSON.stringify({
          ...personaForm,
          template: personaForm.gender === "male" ? "male" : "fashion",
        }),
      });
      setPersonas((prev) => [payload, ...prev]);
      setSelectedPersonaId(payload.id);
      setShowCreatePersona(false);
      setChatInput("");
      appendMessage({ role: "assistant", text: `${payload.name} created. Profile generation started in background.` });
      trackEvent("studio_persona_created", { persona_id: payload.id });
      await refreshPlanSummary(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create persona");
      appendMessage({ role: "system", text: err instanceof Error ? err.message : "Failed to create persona" });
    } finally {
      setCreatingPersona(false);
    }
  };

  const buildProfile = async (mode: "auto" | "offline" | "llm") => {
    if (!selectedPersonaId || busyProfileAction) return;
    try {
      setBusyProfileAction(true);
      setError("");
      appendMessage({ role: "assistant", text: `Starting profile build (${mode.toUpperCase()})...` });
      const statusPayload = await authRequest<PersonaProfileStatus>(`/api/personas/${selectedPersonaId}/profile/generate`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setProfileStatusByPersona((prev) => ({ ...prev, [selectedPersonaId]: statusPayload }));
      await refreshProfileStatus(selectedPersonaId, true);
      await loadPersonaDetail(selectedPersonaId);
      trackEvent("studio_profile_build_started", { persona_id: selectedPersonaId, mode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start profile generation");
      appendMessage({ role: "system", text: err instanceof Error ? err.message : "Failed to start profile generation" });
    } finally {
      setBusyProfileAction(false);
    }
  };

  const generateCalendar = async (month = calendarMonth, year = calendarYear) => {
    if (!selectedPersonaId || busyCalendar) return;
    try {
      setBusyCalendar(true);
      setError("");
      appendMessage({ role: "assistant", text: `Generating calendar ${month}/${year}...` });
      const payload = await authRequest<CalendarMonth>(`/api/calendar/${selectedPersonaId}/generate`, {
        method: "POST",
        body: JSON.stringify({
          month,
          year,
          force_regenerate: forceRegenerate,
        }),
      });
      setCalendar(payload);
      const firstPost = payload.days?.[0]?.posts?.[0];
      if (firstPost) {
        setSelectedPostId(firstPost.id);
        setMediaPrompt(firstPost.prompt);
      }
      await loadCalendarMonths(selectedPersonaId);
      appendMessage({ role: "assistant", text: `Calendar ready: ${payload.days.length} days loaded.` });
      trackEvent("studio_calendar_generated", { persona_id: selectedPersonaId, month, year, mode: payload.mode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate calendar");
      appendMessage({ role: "system", text: err instanceof Error ? err.message : "Failed to generate calendar" });
    } finally {
      setBusyCalendar(false);
    }
  };

  const generateImageFromSelectedPost = async () => {
    if (!selectedPersonaId || !selectedPostId || busyImage) return;
    const prompt = mediaPrompt.trim() || selectedPost?.prompt || "";
    if (!prompt) {
      setError("Prompt is empty.");
      return;
    }
    try {
      setBusyImage(true);
      setError("");
      appendMessage({ role: "assistant", text: "Generating image with fal.ai..." });
      const payload = await authRequest<MediaJob>("/api/media/generate-image", {
        method: "POST",
        body: JSON.stringify({
          persona_id: selectedPersonaId,
          post_id: selectedPostId,
          prompt,
        }),
      });
      setMediaJobs((prev) => [payload, ...prev]);
      await refreshPlanSummary(true);
      await refreshMediaJobs(selectedPersonaId, true);
      trackEvent("studio_media_generate_started", { persona_id: selectedPersonaId, post_id: selectedPostId, job_id: payload.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate image");
      appendMessage({ role: "system", text: err instanceof Error ? err.message : "Failed to generate image" });
    } finally {
      setBusyImage(false);
    }
  };

  const editSelectedImage = async () => {
    if (!selectedPersonaId || !selectedPostId || !selectedMedia || busyEdit) return;
    try {
      setBusyEdit(true);
      setError("");
      appendMessage({ role: "assistant", text: "Launching edit job from selected image..." });
      const payload = await authRequest<MediaJob>("/api/media/edit-image", {
        method: "POST",
        body: JSON.stringify({
          persona_id: selectedPersonaId,
          post_id: selectedPostId,
          source_media_id: selectedMedia.id,
          prompt: mediaPrompt.trim() || selectedPost?.prompt || "Keep identity and adjust framing.",
        }),
      });
      setMediaJobs((prev) => [payload, ...prev]);
      await refreshPlanSummary(true);
      await refreshMediaJobs(selectedPersonaId, true);
      trackEvent("studio_media_edit_started", { persona_id: selectedPersonaId, source_media_id: selectedMedia.id, job_id: payload.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit image");
      appendMessage({ role: "system", text: err instanceof Error ? err.message : "Failed to edit image" });
    } finally {
      setBusyEdit(false);
    }
  };

  const upscaleSelectedImage = async () => {
    if (!selectedPersonaId || !selectedPostId || !selectedMedia || busyUpscale) return;
    try {
      setBusyUpscale(true);
      setError("");
      appendMessage({ role: "assistant", text: "Launching upscale job..." });
      const payload = await authRequest<MediaJob>("/api/media/upscale-image", {
        method: "POST",
        body: JSON.stringify({
          persona_id: selectedPersonaId,
          post_id: selectedPostId,
          source_media_id: selectedMedia.id,
          upscale_factor: 2,
        }),
      });
      setMediaJobs((prev) => [payload, ...prev]);
      await refreshPlanSummary(true);
      await refreshMediaJobs(selectedPersonaId, true);
      trackEvent("studio_media_upscale_started", { persona_id: selectedPersonaId, source_media_id: selectedMedia.id, job_id: payload.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upscale image");
      appendMessage({ role: "system", text: err instanceof Error ? err.message : "Failed to upscale image" });
    } finally {
      setBusyUpscale(false);
    }
  };

  const runSuggestion = async (suggestion: StudioActionSuggestion) => {
    const action = suggestion.action;
    const payload = suggestion.payload ?? {};

    if (action === "create_persona") {
      setShowCreatePersona(true);
      setMobileTab("project");
      return;
    }
    if (action === "select_persona" && typeof payload.persona_id === "string") {
      setSelectedPersonaId(payload.persona_id);
      return;
    }
    if (action === "build_profile_auto") {
      await buildProfile("auto");
      return;
    }
    if (action === "build_profile_llm") {
      await buildProfile("llm");
      return;
    }
    if (action === "build_profile_offline") {
      await buildProfile("offline");
      return;
    }
    if (action === "refresh_profile_status") {
      if (selectedPersonaId) await refreshProfileStatus(selectedPersonaId, true);
      return;
    }
    if (action === "generate_calendar") {
      const month = typeof payload.month === "number" ? payload.month : calendarMonth;
      const year = typeof payload.year === "number" ? payload.year : calendarYear;
      setCalendarMonth(month);
      setCalendarYear(year);
      await generateCalendar(month, year);
      return;
    }
    if (action === "generate_image_from_post") {
      await generateImageFromSelectedPost();
      return;
    }
    if (action === "open_preview") {
      setInspectorTab("preview");
      setMobileTab("preview");
      return;
    }
    if (action === "open_data") {
      setInspectorTab("data");
      setMobileTab("data");
      return;
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || busyChat) return;
    const userText = chatInput.trim();
    setChatInput("");
    appendMessage({ role: "user", text: userText });

    try {
      setBusyChat(true);
      setError("");
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.text }));

      const payload = await authRequest<StudioMessageResponse>("/api/studio/message", {
        method: "POST",
        body: JSON.stringify({
          persona_id: selectedPersonaId || null,
          message: userText,
          history,
        }),
      });

      appendMessage({
        role: "assistant",
        text: payload.reply,
        modelUsed: payload.model_used ?? undefined,
        suggestions: payload.suggestions ?? [],
      });
    } catch (err) {
      const fallbackText = err instanceof Error ? err.message : "Chat request failed";
      appendMessage({ role: "system", text: fallbackText });
      setError(fallbackText);
    } finally {
      setBusyChat(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-8">
        <div className="panel w-full max-w-xl p-6 text-center">
          <p className="section-label">VIDRA BY LEXA AI · STUDIO</p>
          <h1 className="mt-3 text-2xl font-black">Loading chat workspace...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-8">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-label">VIDRA BY LEXA AI · CHAT STUDIO</p>
            <h1 className="mt-1 text-3xl font-black sm:text-5xl">Persona Project Workspace</h1>
            <p className="mt-1 text-sm text-slate-300">
              Chat-first pipeline: Persona -&gt; Profile -&gt; Calendar -&gt; Media (images now, video next).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-xl border border-cyan-300/35 px-3 py-2 text-sm font-semibold text-cyan-100">
              Dashboard
            </Link>
            <Link href="/settings" className="rounded-xl border border-cyan-300/35 px-3 py-2 text-sm font-semibold text-cyan-100">
              Settings
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <article className="subpanel p-3">
            <p className="section-label">Tier</p>
            <p className="mt-1 text-xl font-black">{(plan?.current_tier ?? "free").toUpperCase()}</p>
          </article>
          <article className="subpanel p-3">
            <p className="section-label">Generation</p>
            <p className="mt-1 text-xl font-black">{plan?.generation_mode?.toUpperCase() ?? "OFFLINE"}</p>
          </article>
          <article className="subpanel p-3">
            <p className="section-label">Credits</p>
            <p className="mt-1 text-xl font-black">{plan?.credits_balance ?? 0}</p>
          </article>
          <article className="subpanel p-3">
            <p className="section-label">Model</p>
            <p className="mt-1 text-base font-bold">{plan?.openrouter_model ?? "offline-engine"}</p>
          </article>
        </div>
      </section>

      <div className="panel p-2 lg:hidden">
        <div className="grid grid-cols-4 gap-1">
          {[
            { id: "project" as const, label: "Project" },
            { id: "chat" as const, label: "Chat" },
            { id: "preview" as const, label: "Preview" },
            { id: "data" as const, label: "Data" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              className={`rounded-lg px-2 py-2 text-xs font-bold ${
                mobileTab === tab.id ? "bg-cyan-400 text-slate-950" : "border border-cyan-300/35 text-cyan-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}

      <section className="grid gap-3 xl:grid-cols-[290px_minmax(0,1fr)_420px]">
        <aside className={`${mobileTab === "project" ? "block" : "hidden"} panel p-3 lg:block`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Projects</h2>
            <button
              type="button"
              onClick={() => setShowCreatePersona((v) => !v)}
              className="rounded-lg border border-cyan-300/35 px-2 py-1 text-xs font-bold text-cyan-100"
            >
              {showCreatePersona ? "Close" : "New"}
            </button>
          </div>

          {showCreatePersona ? (
            <div className="subpanel mt-3 space-y-2 p-3">
              <p className="text-xs font-bold text-cyan-100">Create Persona</p>
              <input
                className="w-full rounded-lg border border-slate-300/30 bg-slate-950/70 px-3 py-2 text-sm"
                placeholder="Name"
                value={personaForm.name}
                onChange={(e) => setPersonaForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-slate-300/30 bg-slate-950/70 px-3 py-2 text-sm"
                placeholder="@handle"
                value={personaForm.handle}
                onChange={(e) => setPersonaForm((prev) => ({ ...prev, handle: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={18}
                  max={100}
                  className="rounded-lg border border-slate-300/30 bg-slate-950/70 px-3 py-2 text-sm"
                  value={personaForm.age}
                  onChange={(e) => setPersonaForm((prev) => ({ ...prev, age: Number(e.target.value) || 25 }))}
                />
                <select
                  className="rounded-lg border border-slate-300/30 bg-slate-950/70 px-3 py-2 text-sm"
                  value={personaForm.gender}
                  onChange={(e) => setPersonaForm((prev) => ({ ...prev, gender: e.target.value as "male" | "female" }))}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
              <input
                className="w-full rounded-lg border border-slate-300/30 bg-slate-950/70 px-3 py-2 text-sm"
                placeholder="City"
                value={personaForm.city}
                onChange={(e) => setPersonaForm((prev) => ({ ...prev, city: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-slate-300/30 bg-slate-950/70 px-3 py-2 text-sm"
                placeholder="Niche"
                value={personaForm.niche}
                onChange={(e) => setPersonaForm((prev) => ({ ...prev, niche: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-slate-300/30 bg-slate-950/70 px-3 py-2 text-sm"
                placeholder="Vibe"
                value={personaForm.vibe}
                onChange={(e) => setPersonaForm((prev) => ({ ...prev, vibe: e.target.value }))}
              />
              <button
                type="button"
                onClick={createPersona}
                disabled={creatingPersona}
                className="w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {creatingPersona ? "Creating..." : "Create Persona"}
              </button>
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            {personas.length === 0 ? (
              <div className="subpanel p-3 text-sm text-slate-300">No personas yet. Create your first project.</div>
            ) : (
              personas.map((persona) => {
                const status = profileStatusByPersona[persona.id];
                const isActive = selectedPersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => setSelectedPersonaId(persona.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isActive ? "border-cyan-300/60 bg-cyan-500/10" : "border-slate-300/25 bg-slate-950/40 hover:border-cyan-300/40"
                    }`}
                  >
                    <p className="font-bold text-white">{persona.name}</p>
                    <p className="text-xs text-slate-300">@{persona.handle}</p>
                    <div className={`mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusTone(status?.generation_status)}`}>
                      Profile: {profileLabel(status?.generation_status)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className={`${mobileTab === "chat" ? "block" : "hidden"} panel flex min-h-[70vh] flex-col p-3 lg:block`}>
          <div className="subpanel p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void buildProfile("auto")}
                disabled={!selectedPersonaId || busyProfileAction}
                className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-black text-slate-950 disabled:opacity-60"
              >
                Build Profile
              </button>
              <button
                type="button"
                onClick={() => void generateCalendar()}
                disabled={!selectedPersonaId || !profileReady || busyCalendar}
                className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-bold text-cyan-100 disabled:opacity-60"
              >
                Generate Calendar
              </button>
              <button
                type="button"
                onClick={() => void generateImageFromSelectedPost()}
                disabled={!selectedPersonaId || !profileReady || !selectedPostId || busyImage}
                className="rounded-lg border border-lime-300/40 px-3 py-1.5 text-xs font-bold text-lime-100 disabled:opacity-60"
              >
                Generate Image
              </button>
              <button
                type="button"
                onClick={() => {
                  setInspectorTab("preview");
                  setMobileTab("preview");
                }}
                className="rounded-lg border border-slate-300/30 px-3 py-1.5 text-xs font-bold text-slate-200"
              >
                Open Preview
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-cyan-300/30 bg-cyan-500/10 p-2 text-xs text-cyan-100">
              {!selectedPersonaId
                ? "Next step: create a persona project."
                : !profileReady
                  ? "Next step: build profile. Calendar and media unlock automatically when profile is ready."
                  : !calendar
                    ? "Next step: generate current month calendar."
                    : "Next step: pick a post and generate media. Credits are reserved immediately and refunded automatically on failure."}
            </div>
          </div>

          <div ref={chatRef} className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-300/20 bg-slate-950/35 p-3">
            {messages.map((message) => (
              <article key={message.id} className={`max-w-[92%] rounded-xl border px-3 py-2 ${message.role === "user" ? "ml-auto border-cyan-300/35 bg-cyan-500/10" : "border-slate-300/25 bg-slate-900/70"}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-300">{message.role}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{message.text}</p>
                {message.modelUsed ? <p className="mt-1 text-[11px] text-cyan-200">Model: {message.modelUsed}</p> : null}
                {message.suggestions && message.suggestions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.suggestions.map((suggestion, idx) => (
                      <button
                        key={`${message.id}-${suggestion.action}-${idx}`}
                        type="button"
                        onClick={() => void runSuggestion(suggestion)}
                        className="rounded-md border border-cyan-300/35 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-100"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <textarea
              rows={3}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask: build profile, generate March calendar, render hero image..."
              className="w-full rounded-xl border border-slate-300/30 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300">Chat assistant orchestrates your persona pipeline.</p>
              <button
                type="button"
                onClick={() => void sendChat()}
                disabled={!chatInput.trim() || busyChat}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {busyChat ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </section>

        <aside className={`${mobileTab === "preview" || mobileTab === "data" ? "block" : "hidden"} panel p-3 lg:block`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Inspector</h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setInspectorTab("preview");
                  setMobileTab("preview");
                }}
                className={`rounded-lg px-2 py-1 text-xs font-bold ${inspectorTab === "preview" ? "bg-cyan-400 text-slate-950" : "border border-cyan-300/35 text-cyan-100"}`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  setInspectorTab("data");
                  setMobileTab("data");
                }}
                className={`rounded-lg px-2 py-1 text-xs font-bold ${inspectorTab === "data" ? "bg-cyan-400 text-slate-950" : "border border-cyan-300/35 text-cyan-100"}`}
              >
                Data
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="subpanel p-3">
              <p className="section-label">Pipeline</p>
              <div className="mt-2 grid gap-1">
                <div className={`rounded-md border px-2 py-1 text-xs ${selectedPersonaId ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-slate-300/20 bg-slate-900/70 text-slate-300"}`}>
                  1. Persona {selectedPersonaId ? "Ready" : "Missing"}
                </div>
                <div className={`rounded-md border px-2 py-1 text-xs ${statusTone(activeProfileStatus?.generation_status)}`}>
                  2. Profile {profileLabel(activeProfileStatus?.generation_status)}
                </div>
                <div className={`rounded-md border px-2 py-1 text-xs ${calendar ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-slate-300/20 bg-slate-900/70 text-slate-300"}`}>
                  3. Calendar {calendar ? "Loaded" : "Not generated"}
                </div>
                <div className={`rounded-md border px-2 py-1 text-xs ${completedMedia.length > 0 ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-slate-300/20 bg-slate-900/70 text-slate-300"}`}>
                  4. Media {completedMedia.length > 0 ? `${completedMedia.length} image(s)` : "No output"}
                </div>
              </div>
              {activeProfileStatus ? (
                <div className="mt-2 text-xs text-slate-300">
                  Step: {activeProfileStatus.generation_step ?? "Waiting"} · Elapsed: {formatDuration(activeProfileStatus.elapsed_seconds ?? 0)}
                  {activeProfileStatus.eta_seconds !== null && activeProfileStatus.eta_seconds !== undefined ? ` · ETA: ${formatDuration(activeProfileStatus.eta_seconds)}` : ""}
                </div>
              ) : null}
            </div>
          </div>

          {inspectorTab === "preview" ? (
            <div className="mt-3 space-y-3">
              <div className="subpanel p-3">
                <p className="section-label">Calendar Source</p>
                <div className="mt-2 grid grid-cols-[1fr_88px_88px] gap-2">
                  <select
                    className="rounded-lg border border-slate-300/30 bg-slate-950/70 px-2 py-2 text-sm"
                    value={monthKey(calendarYear, calendarMonth)}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split("-").map(Number);
                      setCalendarYear(y);
                      setCalendarMonth(m);
                      if (selectedPersonaId) void loadCalendar(selectedPersonaId, y, m);
                    }}
                  >
                    <option value={monthKey(calendarYear, calendarMonth)}>
                      {String(calendarMonth).padStart(2, "0")}/{calendarYear}
                    </option>
                    {calendarList.map((m) => (
                      <option key={m.id} value={monthKey(m.year, m.month)}>
                        {String(m.month).padStart(2, "0")}/{m.year}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void generateCalendar()}
                    disabled={!selectedPersonaId || !profileReady || busyCalendar}
                    className="rounded-lg border border-cyan-300/40 px-2 py-2 text-xs font-bold text-cyan-100 disabled:opacity-60"
                  >
                    {busyCalendar ? "..." : "Generate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForceRegenerate((v) => !v)}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold ${forceRegenerate ? "border-lime-300/40 text-lime-100" : "border-slate-300/30 text-slate-300"}`}
                  >
                    Regen
                  </button>
                </div>

                {flattenedPosts.length > 0 ? (
                  <>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-300/30 bg-slate-950/70 px-2 py-2 text-xs"
                      value={selectedPostId}
                      onChange={(e) => {
                        const postId = e.target.value;
                        setSelectedPostId(postId);
                        setMediaPrompt(promptForSelectedPost(calendar, postId));
                      }}
                    >
                      {flattenedPosts.map((post) => (
                        <option key={post.id} value={post.id}>
                          #{post.post_number} {post.scene_type} - {post.time}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={4}
                      value={mediaPrompt}
                      onChange={(e) => setMediaPrompt(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300/30 bg-slate-950/70 px-2 py-2 text-xs"
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => void generateImageFromSelectedPost()}
                        disabled={!selectedPostId || busyImage}
                        className="rounded-lg bg-cyan-400 px-2 py-2 text-xs font-black text-slate-950 disabled:opacity-60"
                      >
                        {busyImage ? "..." : "Generate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void editSelectedImage()}
                        disabled={!selectedMedia || busyEdit}
                        className="rounded-lg border border-cyan-300/40 px-2 py-2 text-xs font-bold text-cyan-100 disabled:opacity-60"
                      >
                        {busyEdit ? "..." : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void upscaleSelectedImage()}
                        disabled={!selectedMedia || busyUpscale}
                        className="rounded-lg border border-lime-300/40 px-2 py-2 text-xs font-bold text-lime-100 disabled:opacity-60"
                      >
                        {busyUpscale ? "..." : "Upscale"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-300">Generate a calendar first to unlock post-linked media creation.</p>
                )}
              </div>

              <div className="subpanel p-3">
                <p className="section-label">Instagram Mockup</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {completedMedia.slice(0, 9).map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setSelectedMediaId(job.id)}
                      className={`relative aspect-square overflow-hidden rounded-md border ${selectedMediaId === job.id ? "border-cyan-300/70" : "border-slate-300/20"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={job.output_url ?? ""} alt="Generated output" className="h-full w-full object-cover" />
                    </button>
                  ))}
                  {completedMedia.length === 0 ? (
                    <div className="col-span-3 rounded-md border border-dashed border-slate-300/30 bg-slate-900/50 p-3 text-xs text-slate-300">
                      No generated images yet.
                    </div>
                  ) : null}
                </div>

                {selectedMedia?.output_url ? (
                  <div className="mt-3 rounded-lg border border-slate-300/25 bg-slate-950/70 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedMedia.output_url} alt="Selected media" className="h-auto w-full rounded-md object-cover" />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-300">
                        {selectedMedia.mode.toUpperCase()} · {selectedMedia.model} · {selectedMedia.cost_credits} credits
                      </p>
                      <a
                        href={selectedMedia.output_url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="rounded-md border border-cyan-300/40 px-2 py-1 text-[11px] font-semibold text-cyan-100"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="subpanel p-3">
                <p className="section-label">Recent Jobs</p>
                <div className="mt-2 space-y-2">
                  {mediaJobs.slice(0, 6).map((job) => (
                    <div key={job.id} className="rounded-md border border-slate-300/20 bg-slate-900/50 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{job.mode.toUpperCase()}</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${statusTone(job.status)}`}>{job.status}</span>
                      </div>
                      <p className="mt-1 text-slate-300">{job.model}</p>
                      {job.status === "failed" && job.error_message ? (
                        <p className="mt-1 text-[11px] text-rose-200">{job.error_message}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="subpanel p-3">
                <p className="section-label">Identity</p>
                <p className="mt-1 text-sm font-semibold">{personaDetail?.persona?.name ?? "No persona selected"}</p>
                <p className="text-xs text-slate-300">@{personaDetail?.persona?.handle ?? "-"}</p>
              </div>

              <div className="subpanel p-3">
                <p className="section-label">Bio</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200">{personaDetail?.profile?.bio || "No bio generated yet."}</p>
              </div>

              <details className="subpanel p-3" open>
                <summary className="cursor-pointer text-sm font-bold">Master Prompt Blueprint</summary>
                <pre className="data-scroll mt-2 text-[11px]">{personaDetail?.profile?.prompt_blueprint || "No prompt blueprint yet."}</pre>
              </details>

              <details className="subpanel p-3">
                <summary className="cursor-pointer text-sm font-bold">Narrative / Backstory</summary>
                <pre className="data-scroll mt-2 text-[11px]">{personaDetail?.profile?.backstory_md || "No backstory yet."}</pre>
              </details>

              <details className="subpanel p-3">
                <summary className="cursor-pointer text-sm font-bold">Strategy / Future Plans</summary>
                <pre className="data-scroll mt-2 text-[11px]">
                  {(personaDetail?.profile?.future_plans_md || "") + "\n\n" + (personaDetail?.profile?.strategy_md || "") || "No strategy yet."}
                </pre>
              </details>

              <details className="subpanel p-3">
                <summary className="cursor-pointer text-sm font-bold">Style DNA + World</summary>
                <pre className="data-scroll mt-2 text-[11px]">
                  {safePretty({
                    physical: personaDetail?.profile?.physical ?? {},
                    wardrobe: personaDetail?.profile?.wardrobe ?? {},
                    beauty: personaDetail?.profile?.beauty ?? {},
                    world: personaDetail?.profile?.world ?? {},
                    carousel_rules: personaDetail?.profile?.carousel_rules ?? {},
                  })}
                </pre>
              </details>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
