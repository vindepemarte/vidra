"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
};

type MyPlan = {
  current_tier: string;
  next_tier?: string | null;
  personas_limit: number;
  generation_days_limit: number;
  generation_mode: string;
  openrouter_enabled?: boolean;
  openrouter_model?: string | null;
};

type CalendarSummary = {
  month: number;
  year: number;
  mode: string;
  days: Array<{
    day: number;
    theme: string;
    mood: string;
    posts: Array<{ post_number: number; time: string; scene_type: string; caption: string }>;
  }>;
};

const now = new Date();

function tierRank(tier: string): number {
  if (tier === "max") return 3;
  if (tier === "pro") return 2;
  return 1;
}

function prettyTier(tier: string): string {
  return tier.toUpperCase();
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

  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [calendar, setCalendar] = useState<CalendarSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyGenerate, setBusyGenerate] = useState(false);
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

        setOverview(overviewData);
        setMyPlan(myPlanData);
        setPlans(plansData.plans);
        setPersonas(personasData);

        if (personasData[0]) {
          setSelectedPersonaId((current) => current || personasData[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot load dashboard");
      } finally {
        setLoading(false);
      }
    }

    void boot();
  }, [router, status, token]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Persona creation failed");
    } finally {
      setBusyCreate(false);
    }
  }

  async function generateMonth() {
    if (!token || !selectedPersonaId || busyGenerate) return;

    try {
      setBusyGenerate(true);
      setError("");

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

      if (overview) {
        setOverview({ ...overview, generated_months_count: overview.generated_months_count + 1 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendar generation failed");
    } finally {
      setBusyGenerate(false);
    }
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tier: targetTier })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as { url: string };
      if (!payload.url) throw new Error("Checkout URL not available.");
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
    return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">Loading control deck...</main>;
  }

  const totalDays = calendar?.days.length ?? 0;
  const visibleDays = showAllDays ? totalDays : Math.min(totalDays, 7);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-7">
      <section className="panel p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">Creator Control Deck</p>
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

        {overview ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100/75">Personas</p>
              <p className="mt-1 text-xl font-black">
                {overview.personas_count}/{overview.personas_limit}
              </p>
            </article>
            <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100/75">Calendars Generated</p>
              <p className="mt-1 text-xl font-black">{overview.generated_months_count}</p>
            </article>
            <article className="rounded-lg border border-cyan-300/20 bg-slate-950/55 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100/75">Generation Engine</p>
              <p className="mt-1 text-xl font-black">{overview.generation_mode.toUpperCase()}</p>
            </article>
          </div>
        ) : null}

        {overview?.openrouter_model ? (
          <p className="mt-3 rounded-md border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            Active OpenRouter model for paid generation: <span className="font-bold">{overview.openrouter_model}</span>
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-4">
          <h2 className="text-lg font-black">What You Get Right Now</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-100">
            {(overview?.value_snapshot ?? []).map((line) => (
              <li key={line} className="rounded-lg border border-cyan-300/20 bg-slate-950/55 px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        </article>

        <article className="panel p-4">
          <h2 className="text-lg font-black">Create Persona</h2>
          <p className="mt-1 text-xs text-slate-300">Your creator identity is the base layer of every calendar.</p>
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
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-4">
          <h2 className="text-lg font-black">Your Personas</h2>
          <div className="mt-3 space-y-2">
            {personas.length === 0 ? (
              <p className="rounded-lg border border-cyan-300/20 bg-slate-950/50 p-3 text-sm text-slate-300">No personas yet.</p>
            ) : (
              personas.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => setSelectedPersonaId(persona.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    selectedPersonaId === persona.id
                      ? "border-cyan-300/70 bg-cyan-500/15"
                      : "border-cyan-300/20 bg-slate-950/50"
                  }`}
                >
                  <p className="font-bold">{persona.name}</p>
                  <p className="text-xs text-slate-300">@{persona.handle} · {persona.city} · {persona.niche}</p>
                </button>
              ))
            )}
          </div>
        </article>

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
              Regenerate month if it already exists (recommended after plan change)
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
      </section>

      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}

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
        </div>

        {currentPlanCard ? (
          <p className="mt-3 text-xs text-slate-300">Current plan outcome focus: {currentPlanCard.tagline}</p>
        ) : null}
      </section>
    </main>
  );
}
