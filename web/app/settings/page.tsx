"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { LogoutButton } from "@/components/logout-button";
import { API_URL } from "@/lib/api";

type MyPlan = {
  current_tier: string;
  next_tier?: string | null;
  personas_limit: number;
  generation_days_limit: number;
  generation_mode: string;
  openrouter_model?: string | null;
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

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;

  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCheckout, setBusyCheckout] = useState(false);
  const [busyPortal, setBusyPortal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    async function load() {
      if (!token) return;
      try {
        setLoading(true);
        setError("");

        const [myPlanRes, plansRes] = await Promise.all([
          fetch(`${API_URL}/api/plans/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/plans`)
        ]);

        if (!myPlanRes.ok) throw new Error(await extractErrorMessage(myPlanRes));
        if (!plansRes.ok) throw new Error(await extractErrorMessage(plansRes));

        const myPlanData = (await myPlanRes.json()) as MyPlan;
        const plansData = (await plansRes.json()) as { plans: Plan[] };

        setMyPlan(myPlanData);
        setPlans(plansData.plans);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot load settings");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router, status, token]);

  const upgradeTargetTier = useMemo(() => myPlan?.next_tier ?? null, [myPlan?.next_tier]);

  async function startCheckout() {
    if (!token || !upgradeTargetTier || busyCheckout) return;

    try {
      setBusyCheckout(true);
      setError("");

      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tier: upgradeTargetTier })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as { url: string };
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot open checkout");
    } finally {
      setBusyCheckout(false);
    }
  }

  async function openPortal() {
    if (!token || busyPortal) return;

    try {
      setBusyPortal(true);
      setError("");

      const res = await fetch(`${API_URL}/api/billing/portal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as { url: string };
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot open billing portal");
    } finally {
      setBusyPortal(false);
    }
  }

  if (status === "loading" || loading) {
    return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6">Loading settings...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-5 sm:px-6">
      <section className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">Account & Billing</p>
            <h1 className="mt-1 text-2xl font-black">Settings</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="rounded-lg border border-cyan-300/40 px-3 py-1 text-xs font-bold text-cyan-100">
              Dashboard
            </Link>
            <LogoutButton />
          </div>
        </div>

        {myPlan ? (
          <div className="mt-3 rounded-lg border border-cyan-300/25 bg-slate-950/55 p-3 text-sm text-slate-100">
            Current tier: <span className="font-black">{myPlan.current_tier.toUpperCase()}</span> · Limits: {myPlan.personas_limit} persona(s), {myPlan.generation_days_limit} days generation, {myPlan.generation_mode.toUpperCase()} mode
          </div>
        ) : null}

        {myPlan?.openrouter_model ? (
          <p className="mt-2 text-xs text-cyan-100">Active paid model: {myPlan.openrouter_model}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {upgradeTargetTier ? (
            <button
              type="button"
              onClick={startCheckout}
              disabled={busyCheckout}
              className="rounded-lg bg-orange-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {busyCheckout ? "Opening checkout..." : `Upgrade to ${upgradeTargetTier.toUpperCase()}`}
            </button>
          ) : (
            <p className="rounded-lg border border-lime-300/40 bg-lime-500/10 px-3 py-2 text-sm text-lime-100">MAX active.</p>
          )}

          {myPlan?.current_tier !== "free" ? (
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
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">Plan Comparison</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-lg border border-cyan-300/25 bg-slate-950/50 p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black">{plan.name}</h3>
                <p className="text-xs font-bold text-cyan-100">€{plan.monthly_price_eur}/mo</p>
              </div>
              <p className="mt-1 text-xs text-slate-300">{plan.tagline}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-100">
                {plan.outcomes.slice(0, 3).map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    </main>
  );
}
