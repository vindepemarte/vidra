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
  city: string;
  niche: string;
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

async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const payload = JSON.parse(text) as { detail?: string };
    if (payload.detail) return payload.detail;
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
    template: "fashion"
  });

  const currentStep = state?.current_step ?? 0;
  const completed = Boolean(state?.completed);
  const progress = useMemo(() => Math.min(100, Math.max(0, (currentStep / 4) * 100)), [currentStep]);

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
      router.push("/dashboard");
    }
  }, [completed, router]);

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
      await saveStep(2, selectedGoal);
      await trackEvent("persona_created", { source: "onboarding" }, token);
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
      await saveStep(3, selectedGoal);
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
      await trackEvent("onboarding_step_completed", { step: 4, completed: true }, token);
      router.push("/dashboard");
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
            <Link href="/dashboard" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-100">
              Skip to Dashboard
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
        <h2 className="text-lg font-black">3. Generate your first week</h2>
        <p className="mt-1 text-xs text-slate-300">
          FREE stays offline with zero external API cost. PRO/MAX unlock advanced generation and media workflows.
        </p>
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
            onClick={generateFirstPreview}
            disabled={busy || !selectedPersonaId}
            className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {busy ? "Generating..." : "Generate Preview Calendar"}
          </button>
        </div>

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
        <h2 className="text-lg font-black">4. Activate command center</h2>
        <p className="mt-1 text-xs text-slate-300">
          Continue into dashboard with persona memory, saved calendars, billing, and media operations.
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
