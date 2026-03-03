"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { LogoutButton } from "@/components/logout-button";
import { API_URL } from "@/lib/api";
import { trackEvent } from "@/lib/events";

type OnboardingState = {
  current_step: number;
  goal?: string | null;
  completed: boolean;
};

type Persona = {
  id: string;
  name: string;
  handle: string;
  age: number;
  city: string;
  niche: string;
  gender: "male" | "female";
};

type PersonaProfileStatus = {
  generation_status: "empty" | "queued" | "generating" | "ready" | "failed";
  generation_requested_mode?: string | null;
  generation_effective_mode?: string | null;
  generation_model_used?: string | null;
  generation_error?: string | null;
  generation_started_at?: string | null;
  generation_completed_at?: string | null;
  generation_run_id?: string | null;
};

type CalendarMonth = {
  month: number;
  year: number;
  mode: string;
  days: Array<{ day: number; theme: string; mood: string }>;
};

const GOALS = [
  { id: "followers", label: "Grow followers faster" },
  { id: "leads", label: "Generate leads and DMs" },
  { id: "brand_deals", label: "Get brand deals" },
  { id: "authority", label: "Build authority in niche" }
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function profileStatusLabel(status?: string): string {
  if (status === "ready") return "Profile ready";
  if (status === "queued") return "Queued";
  if (status === "generating") return "Generating";
  if (status === "failed") return "Failed";
  return "Not generated";
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

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;

  const [state, setState] = useState<OnboardingState | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [profileStates, setProfileStates] = useState<Record<string, PersonaProfileStatus>>({});
  const [selectedGoal, setSelectedGoal] = useState("followers");
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [preview, setPreview] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [personaForm, setPersonaForm] = useState({
    name: "",
    handle: "",
    age: 24,
    city: "Milan",
    niche: "Fashion & Lifestyle",
    vibe: "Confident, modern, premium",
    gender: "female" as "male" | "female",
    template: "fashion"
  });

  const currentStep = state?.current_step ?? 0;
  const completed = Boolean(state?.completed);
  const progress = useMemo(() => Math.min(100, Math.max(0, (currentStep / 5) * 100)), [currentStep]);
  const selectedPersonaProfile = selectedPersonaId ? profileStates[selectedPersonaId] : undefined;
  const isProfileReady = selectedPersonaProfile?.generation_status === "ready";

  async function saveStep(step: number, goal?: string): Promise<void> {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/onboarding/step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ step, goal })
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res));
    const payload = (await res.json()) as OnboardingState;
    setState(payload);
  }

  async function loadBootData(): Promise<void> {
    if (!token) return;
    const [stateRes, personasRes] = await Promise.all([
      fetch(`${API_URL}/api/onboarding/state`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/personas`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    if (!stateRes.ok) throw new Error(await extractErrorMessage(stateRes));
    if (!personasRes.ok) throw new Error(await extractErrorMessage(personasRes));

    const statePayload = (await stateRes.json()) as OnboardingState;
    const personaPayload = (await personasRes.json()) as Persona[];
    setState(statePayload);
    setPersonas(personaPayload);
    setSelectedGoal(statePayload.goal?.trim() || "followers");

    if (personaPayload[0]) {
      setSelectedPersonaId(personaPayload[0].id);
    }

    const statusRows = await Promise.all(
      personaPayload.map(async (persona) => {
        const statusRes = await fetch(`${API_URL}/api/personas/${persona.id}/profile/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!statusRes.ok) return [persona.id, null] as const;
        return [persona.id, (await statusRes.json()) as PersonaProfileStatus] as const;
      })
    );
    setProfileStates(
      statusRows.reduce<Record<string, PersonaProfileStatus>>((acc, [personaId, statusPayload]) => {
        if (statusPayload) acc[personaId] = statusPayload;
        return acc;
      }, {})
    );
  }

  async function fetchProfileStatus(personaId: string): Promise<PersonaProfileStatus | null> {
    if (!token || !personaId) return null;
    const res = await fetch(`${API_URL}/api/personas/${personaId}/profile/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as PersonaProfileStatus;
    setProfileStates((prev) => ({ ...prev, [personaId]: payload }));
    return payload;
  }

  async function pollProfileStatus(personaId: string, maxAttempts = 120): Promise<PersonaProfileStatus | null> {
    for (let i = 0; i < maxAttempts; i += 1) {
      const payload = await fetchProfileStatus(personaId);
      if (!payload) return null;
      if (payload.generation_status === "ready" || payload.generation_status === "failed") {
        return payload;
      }
      await sleep(1500);
    }
    return null;
  }

  async function startProfileBuild(mode: "auto" | "offline" | "llm" = "auto"): Promise<void> {
    if (!token || !selectedPersonaId || busy) return;
    try {
      setBusy(true);
      setError("");
      const res = await fetch(`${API_URL}/api/personas/${selectedPersonaId}/profile/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      await saveStep(3, selectedGoal);
      const finalStatus = await pollProfileStatus(selectedPersonaId);
      if (finalStatus?.generation_status === "ready") {
        await trackEvent("onboarding_step_completed", { step: 3, status: "ready" }, token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot start profile generation");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    async function boot() {
      if (!token) return;
      try {
        setLoading(true);
        setError("");
        await loadBootData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot load onboarding");
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") {
      void boot();
    }
  }, [router, status, token]);

  useEffect(() => {
    if (completed) {
      router.push("/studio");
    }
  }, [completed, router]);

  useEffect(() => {
    if (!token || !selectedPersonaId) return;
    const statusValue = profileStates[selectedPersonaId]?.generation_status;
    if (statusValue === "ready" || statusValue === "failed") return;
    void pollProfileStatus(selectedPersonaId, 80);
  }, [token, selectedPersonaId]);

  async function chooseGoal(goalId: string): Promise<void> {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      setSelectedGoal(goalId);
      await saveStep(1, goalId);
      await trackEvent("onboarding_step_completed", { step: 1, goal: goalId }, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save goal");
    } finally {
      setBusy(false);
    }
  }

  async function createPersona(): Promise<void> {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      const res = await fetch(`${API_URL}/api/personas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(personaForm)
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      const created = (await res.json()) as Persona;
      setPersonas((prev) => [created, ...prev]);
      setSelectedPersonaId(created.id);
      setProfileStates((prev) => ({
        ...prev,
        [created.id]: {
          generation_status: "queued"
        }
      }));
      await saveStep(2, selectedGoal);
      await saveStep(3, selectedGoal);
      await trackEvent("persona_created", { source: "onboarding" }, token);
      await pollProfileStatus(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create persona");
    } finally {
      setBusy(false);
    }
  }

  async function continueWithExistingPersona(): Promise<void> {
    if (!token || busy || !selectedPersonaId) return;
    try {
      setBusy(true);
      setError("");
      await saveStep(2, selectedGoal);
      await saveStep(3, selectedGoal);
      const statusPayload = await fetchProfileStatus(selectedPersonaId);
      if (statusPayload?.generation_status !== "ready") {
        await pollProfileStatus(selectedPersonaId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot continue");
    } finally {
      setBusy(false);
    }
  }

  async function generateFirstPreview(): Promise<void> {
    if (!token || busy || !selectedPersonaId) return;
    try {
      setBusy(true);
      setError("");
      const statusPayload = profileStates[selectedPersonaId] ?? (await fetchProfileStatus(selectedPersonaId));
      if (!statusPayload || statusPayload.generation_status !== "ready") {
        throw new Error("Profile is not ready yet. Wait for profile build to complete before preview generation.");
      }
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const res = await fetch(`${API_URL}/api/calendar/${selectedPersonaId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ month, year, force_regenerate: true })
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      const payload = (await res.json()) as CalendarMonth;
      setPreview(payload);
      await saveStep(4, selectedGoal);
      await trackEvent("calendar_generated", { source: "onboarding" }, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot generate preview");
    } finally {
      setBusy(false);
    }
  }

  async function completeOnboarding(): Promise<void> {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      const res = await fetch(`${API_URL}/api/onboarding/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      await trackEvent("onboarding_step_completed", { step: 5, completed: true }, token);
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot complete onboarding");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || loading) {
    return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6">Loading onboarding...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-5 sm:px-6">
      <section className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Vidra by Lexa AI</p>
            <h1 className="mt-1 text-2xl font-black sm:text-4xl">Guided Onboarding</h1>
            <p className="mt-1 text-xs text-slate-300">
              Build identity, generate first week, and activate your creator system in minutes.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/studio" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-100">
              Skip to Studio
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-cyan-300/30 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs text-cyan-100">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-900">
            <div className="h-2 rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">1. Pick your growth goal</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {GOALS.map((goal) => (
            <button
              key={goal.id}
              type="button"
              disabled={busy}
              onClick={() => chooseGoal(goal.id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                selectedGoal === goal.id
                  ? "border-lime-300/60 bg-lime-500/10 text-lime-100"
                  : "border-cyan-300/30 bg-slate-950/50 text-slate-100"
              }`}
            >
              {goal.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">2. Seed your first persona</h2>
        <p className="mt-1 text-xs text-slate-300">This identity powers all prompts, styles, captions, and carousel logic.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
            placeholder="Name"
            value={personaForm.name}
            onChange={(e) => setPersonaForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
            placeholder="Handle"
            value={personaForm.handle}
            onChange={(e) => setPersonaForm((prev) => ({ ...prev, handle: e.target.value }))}
          />
          <input
            className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
            type="number"
            min={18}
            max={100}
            value={personaForm.age}
            onChange={(e) => setPersonaForm((prev) => ({ ...prev, age: Number(e.target.value) }))}
            placeholder="Age"
          />
          <select
            className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
            value={personaForm.gender}
            onChange={(e) => setPersonaForm((prev) => ({ ...prev, gender: e.target.value as "male" | "female" }))}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          <input
            className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
            placeholder="City"
            value={personaForm.city}
            onChange={(e) => setPersonaForm((prev) => ({ ...prev, city: e.target.value }))}
          />
          <input
            className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
            placeholder="Niche"
            value={personaForm.niche}
            onChange={(e) => setPersonaForm((prev) => ({ ...prev, niche: e.target.value }))}
          />
          <input
            className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2 sm:col-span-2"
            placeholder="Vibe (e.g. Confident, modern, premium)"
            value={personaForm.vibe}
            onChange={(e) => setPersonaForm((prev) => ({ ...prev, vibe: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={createPersona}
            disabled={busy || !personaForm.name || !personaForm.handle}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {busy ? "Working..." : "Create Persona"}
          </button>
          {personas.length > 0 ? (
            <button
              type="button"
              onClick={continueWithExistingPersona}
              disabled={busy || !selectedPersonaId}
              className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"
            >
              Use Existing Persona
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">3. Build persona profile intelligence</h2>
        <p className="mt-1 text-xs text-slate-300">Calendar and Media unlock only when profile generation is ready.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={selectedPersonaId}
            onChange={(e) => setSelectedPersonaId(e.target.value)}
            className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2 text-sm"
          >
            <option value="">Select persona</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name} · @{persona.handle}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void startProfileBuild("auto")}
            disabled={busy || !selectedPersonaId}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {busy ? "Working..." : "Start / Retry Profile Build"}
          </button>
        </div>

        {selectedPersonaId ? (
          <div className="mt-3 rounded-lg border border-cyan-300/30 bg-slate-950/50 p-3">
            <p className="text-sm font-bold">Profile status: {profileStatusLabel(selectedPersonaProfile?.generation_status)}</p>
            <p className="mt-1 text-xs text-slate-200">
              Mode: {selectedPersonaProfile?.generation_effective_mode?.toUpperCase() || "AUTO"} · Model:{" "}
              {selectedPersonaProfile?.generation_model_used || "pending"}
            </p>
            {selectedPersonaProfile?.generation_error ? (
              <p className="mt-2 text-xs text-rose-200">{selectedPersonaProfile.generation_error}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">4. Generate your first week preview</h2>
        <p className="mt-1 text-xs text-slate-300">
          FREE stays offline with zero external API cost. PRO/MAX unlock advanced generation and media workflows.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateFirstPreview}
            disabled={busy || !selectedPersonaId || !isProfileReady}
            className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {busy ? "Generating..." : "Generate Preview Calendar"}
          </button>
        </div>

        {!isProfileReady ? (
          <p className="mt-3 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Profile must be ready before preview generation.
          </p>
        ) : null}

        {preview ? (
          <div className="mt-3 rounded-lg border border-cyan-300/30 bg-slate-950/50 p-3">
            <p className="text-sm font-bold">
              Preview ready: {preview.year}-{String(preview.month).padStart(2, "0")} · {preview.mode.toUpperCase()} · {preview.days.length} day(s)
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-200">
              {preview.days.slice(0, 3).map((day) => (
                <li key={day.day}>
                  Day {day.day}: {day.theme} ({day.mood})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">5. Activate command center</h2>
        <p className="mt-1 text-xs text-slate-300">
          Continue into Studio with persona memory, saved calendars, billing, and media operations.
        </p>
        <button
          type="button"
          onClick={completeOnboarding}
          disabled={busy}
          className="mt-3 rounded-lg bg-orange-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
        >
          {busy ? "Completing..." : "Finish Onboarding"}
        </button>
      </section>

      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    </main>
  );
}
