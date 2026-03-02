"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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

type Plan = {
  id: string;
  name: string;
  monthly_price_eur: number;
  tagline: string;
  outcomes: string[];
  limits: { personas: number; generation_days: number };
  generation_mode: string;
};

type DashboardOverview = {
  current_tier: string;
  personas_count: number;
  personas_limit: number;
  generated_months_count: number;
  generation_days_limit: number;
  generation_mode: string;
  openrouter_enabled?: boolean;
  openrouter_model?: string | null;
  value_snapshot: string[];
  onboarding_completed: boolean;
  credits_balance: number;
  included_credits: number;
  persona_health_score: number;
  weekly_quests: string[];
};

type MyPlan = {
  current_tier: string;
  next_tier?: string | null;
  personas_limit: number;
  generation_days_limit: number;
  generation_mode: string;
  openrouter_enabled?: boolean;
  openrouter_model?: string | null;
  credits_balance?: number;
  included_credits?: number;
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
  theme: string;
  mood: string;
  posts: CalendarPost[];
};

type CalendarSummary = {
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

const now = new Date();

type DashboardTab = "command" | "personas" | "calendar" | "growth";

function tierRank(tier: string): number {
  if (tier === "max") return 3;
  if (tier === "pro") return 2;
  return 1;
}

function prettyTier(tier: string): string {
  return tier.toUpperCase();
}

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

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>("command");

  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedArchiveKey, setSelectedArchiveKey] = useState("");
  const [calendar, setCalendar] = useState<CalendarSummary | null>(null);
  const [calendarArchive, setCalendarArchive] = useState<Record<string, CalendarMonthSummary[]>>({});

  const [loading, setLoading] = useState(true);
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyGenerate, setBusyGenerate] = useState(false);
  const [busyDeletePersonaId, setBusyDeletePersonaId] = useState<string | null>(null);
  const [busyLoadMonth, setBusyLoadMonth] = useState(false);
  const [busyCheckoutTier, setBusyCheckoutTier] = useState<string | null>(null);
  const [busyPortal, setBusyPortal] = useState(false);
  const [forceRegenerate, setForceRegenerate] = useState(true);
  const [showAllDays, setShowAllDays] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    handle: "",
    age: 25,
    city: "Milan",
    niche: "Fashion & Lifestyle",
    vibe: "Elegant, bold, authentic",
    template: "fashion"
  });

  const refreshPersonaArchive = async (
    personaId: string,
    options?: { autoLoadLatest?: boolean; preserveCurrentMonth?: boolean }
  ): Promise<CalendarMonthSummary[]> => {
    if (!token || !personaId) return [];

    const res = await fetch(`${API_URL}/api/calendar/${personaId}/months`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error(await extractErrorMessage(res));
    }

    const payload = (await res.json()) as CalendarMonthList;
    const months = payload.months ?? [];

    setCalendarArchive((prev) => ({
      ...prev,
      [personaId]: months
    }));

    if (options?.autoLoadLatest && months[0]) {
      const latest = months[0];
      setMonth(latest.month);
      setYear(latest.year);
      setSelectedArchiveKey(monthKey(latest.year, latest.month));
      await loadSavedMonth(personaId, latest.year, latest.month);
    }

    if (months.length === 0 && !options?.preserveCurrentMonth) {
      setCalendar(null);
      setSelectedArchiveKey("");
    }

    return months;
  };

  const loadSavedMonth = async (personaId: string, targetYear: number, targetMonth: number): Promise<void> => {
    if (!token || !personaId) return;

    try {
      setBusyLoadMonth(true);
      setError("");

      const res = await fetch(`${API_URL}/api/calendar/${personaId}/${targetYear}/${targetMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const data = (await res.json()) as CalendarSummary;
      setCalendar(data);
      setShowAllDays(false);
      setSelectedArchiveKey(monthKey(targetYear, targetMonth));
      setMonth(targetMonth);
      setYear(targetYear);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load saved month");
    } finally {
      setBusyLoadMonth(false);
    }
  };

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

        const [overviewRes, myPlanRes, plansRes, personasRes] = await Promise.all([
          fetch(`${API_URL}/api/dashboard/overview`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/plans/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/plans`),
          fetch(`${API_URL}/api/personas`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (!overviewRes.ok) throw new Error(await extractErrorMessage(overviewRes));
        if (!myPlanRes.ok) throw new Error(await extractErrorMessage(myPlanRes));
        if (!plansRes.ok) throw new Error(await extractErrorMessage(plansRes));
        if (!personasRes.ok) throw new Error(await extractErrorMessage(personasRes));

        const overviewData = (await overviewRes.json()) as DashboardOverview;
        const myPlanData = (await myPlanRes.json()) as MyPlan;
        const plansData = (await plansRes.json()) as { plans: Plan[] };
        const personasData = (await personasRes.json()) as Persona[];

        if (!overviewData.onboarding_completed) {
          router.push("/onboarding");
          return;
        }

        setOverview(overviewData);
        setMyPlan(myPlanData);
        setPlans(plansData.plans);
        setPersonas(personasData);

        if (personasData[0]) {
          setSelectedPersonaId(personasData[0].id);
        } else {
          setSelectedPersonaId("");
          setCalendar(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot load dashboard");
      } finally {
        setLoading(false);
      }
    }

    void boot();
  }, [router, status, token]);

  useEffect(() => {
    if (!token || !selectedPersonaId) return;

    void refreshPersonaArchive(selectedPersonaId, { autoLoadLatest: true });
  }, [token, selectedPersonaId]);

  const currentTier = useMemo(() => overview?.current_tier ?? "free", [overview?.current_tier]);

  const currentPlanCard = useMemo(
    () => plans.find((plan) => plan.id === currentTier) ?? null,
    [currentTier, plans]
  );

  const upgradeOptions = useMemo(
    () => plans.filter((plan) => tierRank(plan.id) > tierRank(currentTier)),
    [plans, currentTier]
  );

  const canCreatePersona = useMemo(() => {
    if (!overview) return true;
    return overview.personas_count < overview.personas_limit;
  }, [overview]);

  const currentArchive = useMemo(
    () => calendarArchive[selectedPersonaId] ?? [],
    [calendarArchive, selectedPersonaId]
  );

  const generationStatus = useMemo(() => {
    if (!myPlan) return "Loading generation mode...";

    const tier = myPlan.current_tier;
    const isPaidTier = tier === "pro" || tier === "max";

    if (myPlan.generation_mode === "llm" && myPlan.openrouter_enabled) {
      return `Paid AI mode active (${myPlan.generation_days_limit} days per generation).`;
    }

    if (isPaidTier && !myPlan.openrouter_enabled) {
      return `Paid tier detected but OpenRouter is not configured. Falling back to offline mode (${myPlan.generation_days_limit} days).`;
    }

    return `Offline mode active (${myPlan.generation_days_limit} days per generation).`;
  }, [myPlan]);

  async function createPersona() {
    if (!token || busyCreate) return;

    try {
      setBusyCreate(true);
      setError("");

      const res = await fetch(`${API_URL}/api/personas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const created = (await res.json()) as Persona;
      const next = [created, ...personas];
      setPersonas(next);
      setSelectedPersonaId(created.id);

      if (overview) {
        setOverview({ ...overview, personas_count: overview.personas_count + 1 });
      }

      setForm({ ...form, name: "", handle: "" });
      await trackEvent("persona_created", { source: "dashboard" }, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Persona creation failed");
    } finally {
      setBusyCreate(false);
    }
  }

  async function deletePersona(personaId: string) {
    if (!token || busyDeletePersonaId) return;

    const persona = personas.find((item) => item.id === personaId);
    const proceed = window.confirm(`Delete persona ${persona?.name ?? ""}? This will remove profiles and saved calendars.`);
    if (!proceed) return;

    try {
      setBusyDeletePersonaId(personaId);
      setError("");

      const res = await fetch(`${API_URL}/api/personas/${personaId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const next = personas.filter((item) => item.id !== personaId);
      setPersonas(next);

      setCalendarArchive((prev) => {
        const clone = { ...prev };
        delete clone[personaId];
        return clone;
      });

      if (overview) {
        setOverview({ ...overview, personas_count: Math.max(0, overview.personas_count - 1) });
      }

      if (selectedPersonaId === personaId) {
        const fallback = next[0]?.id ?? "";
        setSelectedPersonaId(fallback);
        if (!fallback) {
          setCalendar(null);
          setSelectedArchiveKey("");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete persona");
    } finally {
      setBusyDeletePersonaId(null);
    }
  }

  async function generateMonth() {
    if (!token || !selectedPersonaId || busyGenerate) return;

    try {
      setBusyGenerate(true);
      setError("");
      const alreadySaved = currentArchive.some((entry) => entry.year === year && entry.month === month);

      const res = await fetch(`${API_URL}/api/calendar/${selectedPersonaId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ month, year, force_regenerate: forceRegenerate })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const data = (await res.json()) as CalendarSummary;
      setCalendar(data);
      setShowAllDays(false);
      setSelectedArchiveKey(monthKey(year, month));

      await refreshPersonaArchive(selectedPersonaId, { preserveCurrentMonth: true });
      await trackEvent("calendar_generated", { month, year, source: "dashboard" }, token);

      if (overview && !alreadySaved) {
        setOverview({ ...overview, generated_months_count: overview.generated_months_count + 1 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendar generation failed");
    } finally {
      setBusyGenerate(false);
    }
  }

  async function loadSelectedArchiveMonth() {
    if (!selectedPersonaId || !selectedArchiveKey) return;
    const [selectedYear, selectedMonth] = selectedArchiveKey.split("-").map(Number);
    if (!selectedYear || !selectedMonth) return;
    await loadSavedMonth(selectedPersonaId, selectedYear, selectedMonth);
  }

  async function startCheckout(targetTier: string) {
    if (!token || busyCheckoutTier) return;

    try {
      setBusyCheckoutTier(targetTier);
      setError("");

      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `${Date.now()}-${targetTier}`
        },
        body: JSON.stringify({ tier: targetTier })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as { url: string };
      if (!payload.url) throw new Error("Checkout URL not available.");
      await trackEvent("checkout_started", { target_tier: targetTier }, token);
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot open checkout");
      setBusyCheckoutTier(null);
    }
  }

  async function openPortal() {
    if (!token || busyPortal) return;

    try {
      setBusyPortal(true);
      setError("");

      const res = await fetch(`${API_URL}/api/billing/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as { url: string };
      if (!payload.url) throw new Error("Billing portal URL not available.");
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot open billing portal");
    } finally {
      setBusyPortal(false);
    }
  }

  if (status === "loading" || loading) {
    return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">Loading command center...</main>;
  }

  const totalDays = calendar?.days.length ?? 0;
  const visibleDays = showAllDays ? totalDays : Math.min(totalDays, 7);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-7">
      <section className="panel p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">Vidra by Lexa AI</p>
            <h1 className="mt-1 text-2xl font-black sm:text-4xl">Production Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-lime-300/50 bg-lime-400/15 px-3 py-1 text-xs font-black text-lime-100">
              {prettyTier(currentTier)}
            </div>
            <Link href="/settings" className="rounded-lg border border-cyan-300/40 px-3 py-1 text-xs font-bold text-cyan-100">
              Settings
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ["command", "Command Center"],
            ["personas", "Personas"],
            ["calendar", "Calendar"],
            ["growth", "Growth & Plans"]
          ] as Array<[DashboardTab, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                activeTab === id
                  ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100"
                  : "border-cyan-300/25 bg-slate-950/50 text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {overview ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100/75">Personas</p>
              <p className="mt-1 text-xl font-black">
                {overview.personas_count}/{overview.personas_limit}
              </p>
            </article>
            <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100/75">Calendars</p>
              <p className="mt-1 text-xl font-black">{overview.generated_months_count}</p>
            </article>
            <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100/75">Health Score</p>
              <p className="mt-1 text-xl font-black">{overview.persona_health_score}/100</p>
            </article>
            <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100/75">Credits</p>
              <p className="mt-1 text-xl font-black">{overview.credits_balance}</p>
            </article>
          </div>
        ) : null}

        {overview?.openrouter_model ? (
          <p className="mt-3 rounded-md border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            Active OpenRouter model for paid generation: <span className="font-bold">{overview.openrouter_model}</span>
          </p>
        ) : null}
      </section>

      {activeTab === "command" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel p-4">
            <h2 className="text-lg font-black">Today&apos;s Actions</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-100">
              <li className="rounded-lg border border-cyan-300/20 bg-slate-950/55 px-3 py-2">
                Generate one fresh monthly plan for your best persona.
              </li>
              <li className="rounded-lg border border-cyan-300/20 bg-slate-950/55 px-3 py-2">
                Open persona profile and refresh style DNA if niche shifted.
              </li>
              <li className="rounded-lg border border-cyan-300/20 bg-slate-950/55 px-3 py-2">
                Ship one carousel with coherent slide prompts.
              </li>
            </ul>
          </article>

          <article className="panel p-4">
            <h2 className="text-lg font-black">Value Snapshot</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-100">
              {(overview?.value_snapshot ?? []).map((line) => (
                <li key={line} className="rounded-lg border border-cyan-300/20 bg-slate-950/55 px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
          </article>

          <article className="panel p-4 lg:col-span-2">
            <h2 className="text-lg font-black">Weekly Creator Quests</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(overview?.weekly_quests ?? []).map((quest) => (
                <div key={quest} className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3 text-sm text-slate-100">
                  {quest}
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "personas" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel p-4">
            <h2 className="text-lg font-black">Create Persona</h2>
            <p className="mt-1 text-xs text-slate-300">Identity memory drives all prompts, wardrobes, beauty, and post continuity.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                placeholder="Handle"
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
              />
              <input
                className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <input
                className="rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                placeholder="Niche"
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
              />
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-cyan-400 py-2 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={createPersona}
              type="button"
              disabled={!canCreatePersona || busyCreate || !form.name || !form.handle}
            >
              {busyCreate ? "Creating..." : canCreatePersona ? "Create Persona" : "Persona Limit Reached"}
            </button>
          </article>

          <article className="panel p-4">
            <h2 className="text-lg font-black">Persona Library</h2>
            <div className="mt-3 space-y-2">
              {personas.length === 0 ? (
                <p className="rounded-lg border border-cyan-300/20 bg-slate-950/50 p-3 text-sm text-slate-300">No personas yet.</p>
              ) : (
                personas.map((persona) => (
                  <div
                    key={persona.id}
                    className={`rounded-lg border px-3 py-2 ${
                      selectedPersonaId === persona.id
                        ? "border-cyan-300/70 bg-cyan-500/15"
                        : "border-cyan-300/20 bg-slate-950/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPersonaId(persona.id);
                        setSelectedArchiveKey("");
                      }}
                      className="w-full text-left"
                    >
                      <p className="font-bold">{persona.name}</p>
                      <p className="text-xs text-slate-300">@{persona.handle} · {persona.city} · {persona.niche}</p>
                    </button>
                    <div className="mt-2 flex gap-2">
                      <Link
                        href={`/persona/${persona.id}`}
                        className="rounded-md border border-cyan-300/40 px-2 py-1 text-xs font-bold text-cyan-100"
                      >
                        Open Persona Page
                      </Link>
                      <button
                        type="button"
                        onClick={() => deletePersona(persona.id)}
                        disabled={busyDeletePersonaId !== null}
                        className="rounded-md border border-red-300/40 px-2 py-1 text-xs font-bold text-red-200 disabled:opacity-50"
                      >
                        {busyDeletePersonaId === persona.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "calendar" ? (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="panel p-4">
              <h2 className="text-lg font-black">Generate Calendar</h2>
              <p className="mt-1 text-xs text-slate-300">{generationStatus}</p>

              <div className="mt-3 space-y-2">
                <select
                  className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                  value={selectedPersonaId}
                  onChange={(e) => setSelectedPersonaId(e.target.value)}
                >
                  <option value="">Select persona</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input
                    className="w-1/2 rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                    type="number"
                    min={1}
                    max={12}
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  />
                  <input
                    className="w-1/2 rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                    type="number"
                    min={2025}
                    max={2100}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  />
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={forceRegenerate}
                    onChange={(e) => setForceRegenerate(e.target.checked)}
                  />
                  Force regenerate this month (recommended after persona/profile changes)
                </label>

                <button
                  className="w-full rounded-lg bg-lime-400 py-2 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={generateMonth}
                  type="button"
                  disabled={!selectedPersonaId || busyGenerate}
                >
                  {busyGenerate ? "Generating..." : "Generate Content Plan"}
                </button>
              </div>
            </article>

            <article className="panel p-4">
              <h2 className="text-lg font-black">Saved Calendars</h2>
              {currentArchive.length === 0 ? (
                <p className="mt-2 rounded-lg border border-cyan-300/20 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                  No saved month for this persona yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                      value={selectedArchiveKey}
                      onChange={(e) => setSelectedArchiveKey(e.target.value)}
                    >
                      <option value="">Select saved month</option>
                      {currentArchive.map((entry) => (
                        <option key={entry.id} value={monthKey(entry.year, entry.month)}>
                          {entry.year}-{String(entry.month).padStart(2, "0")} · {entry.mode.toUpperCase()} · {entry.days_count} days
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={loadSelectedArchiveMonth}
                      disabled={!selectedArchiveKey || busyLoadMonth}
                      className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"
                    >
                      {busyLoadMonth ? "Loading..." : "Load Month"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          </section>

          {calendar ? (
            <section className="panel p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-black">
                  Calendar {calendar.year}-{String(calendar.month).padStart(2, "0")}
                </h2>
                <span className="rounded-md border border-cyan-300/40 px-2 py-1 text-xs font-bold text-cyan-100">{calendar.mode.toUpperCase()}</span>
              </div>

              <p className="mt-1 text-xs text-slate-300">
                Generated {calendar.days.length} day(s). Showing {visibleDays}.
              </p>

              <div className="mt-3 space-y-3">
                {calendar.days.slice(0, visibleDays).map((day) => (
                  <article key={day.day} className="rounded-lg border border-cyan-300/20 bg-slate-950/50 p-3">
                    <p className="font-semibold">
                      Day {day.day}: {day.theme} ({day.mood})
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-100">
                      {day.posts.slice(0, 2).map((post) => (
                        <li key={post.post_number}>[{post.time}] {post.scene_type} - {post.caption}</li>
                      ))}
                    </ul>
                    {day.posts[0]?.slides?.length ? (
                      <p className="mt-2 text-xs text-cyan-100/90">
                        Carousel blueprint ready: {day.posts[0].slides.length} slide prompts saved per post.
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>

              {calendar.days.length > 7 ? (
                <button
                  type="button"
                  onClick={() => setShowAllDays((v) => !v)}
                  className="mt-3 rounded-lg border border-cyan-300/40 px-3 py-2 text-sm font-bold text-cyan-100"
                >
                  {showAllDays ? "Show less" : "Show all generated days"}
                </button>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab === "growth" ? (
        <section className="panel p-4">
          <h2 className="text-lg font-black">Plans & Upgrade</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {plans.map((plan) => {
              const active = plan.id === currentTier;
              return (
                <article
                  key={plan.id}
                  className={`rounded-xl border p-3 ${
                    active ? "border-lime-300/70 bg-lime-500/10" : "border-cyan-300/25 bg-slate-950/45"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black">{plan.name}</h3>
                    <p className="text-xs font-bold text-cyan-100">€{plan.monthly_price_eur}/mo</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-200/90">{plan.tagline}</p>
                  <p className="mt-2 text-xs text-slate-300">
                    {plan.limits.personas} persona(s) · {plan.limits.generation_days} days · {plan.generation_mode.toUpperCase()}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {upgradeOptions.length > 0 ? (
              upgradeOptions.map((targetPlan) => (
                <button
                  key={targetPlan.id}
                  type="button"
                  onClick={() => startCheckout(targetPlan.id)}
                  disabled={busyCheckoutTier !== null}
                  className="rounded-lg bg-orange-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  {busyCheckoutTier === targetPlan.id ? "Opening checkout..." : `Upgrade to ${targetPlan.name}`}
                </button>
              ))
            ) : (
              <p className="rounded-lg border border-lime-300/40 bg-lime-500/10 px-3 py-2 text-sm text-lime-100">
                You are on MAX. Portfolio mode unlocked.
              </p>
            )}

            {currentTier !== "free" ? (
              <button
                type="button"
                onClick={openPortal}
                disabled={busyPortal}
                className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"
              >
                {busyPortal ? "Opening portal..." : "Manage Billing"}
              </button>
            ) : null}

            <Link href="/settings" className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100">
              Credits & API Keys
            </Link>
          </div>

          {currentPlanCard ? (
            <p className="mt-3 text-xs text-slate-300">Current plan outcome focus: {currentPlanCard.tagline}</p>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    </main>
  );
}
