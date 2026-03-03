import Link from "next/link";

import { API_URL } from "@/lib/api";

type Plan = {
  id: string;
  name: string;
  monthly_price_eur: number;
  tagline: string;
  outcomes: string[];
  limits: { personas: number; generation_days: number };
  generation_mode: string;
  entitlements?: {
    calendar_generations: string;
    calendar_regenerations: string;
    personas_limit: number;
    generation_days_per_run: number;
    included_credits_monthly: number;
    media_generation_requires_credits: boolean;
  };
};

function formatLimit(value: number): string {
  if (value >= 9999) return "Unlimited";
  return String(value);
}

const FALLBACK_PLANS: Plan[] = [
  {
    id: "free",
    name: "FREE",
    monthly_price_eur: 0,
    tagline: "Start one creator identity with zero external API cost.",
    outcomes: [
      "1 persona with full identity DNA",
      "7-day generation + carousel prompt chains",
      "Offline strategy, captions, and weekly consistency flow",
      "Prompt memory for repeatable visual coherence"
    ],
    limits: { personas: 1, generation_days: 7 },
    generation_mode: "offline"
  },
  {
    id: "pro",
    name: "PRO",
    monthly_price_eur: 29,
    tagline: "Turn creator content into an AI-assisted growth machine.",
    outcomes: [
      "10 personas + 30-day planning",
      "Unlimited generations, regenerations fair-use rate-limited",
      "OpenRouter-powered strategy and hooks",
      "fal.ai image generation with monthly included credits",
      "Faster campaign execution and conversion focus"
    ],
    limits: { personas: 10, generation_days: 30 },
    generation_mode: "llm"
  },
  {
    id: "max",
    name: "MAX",
    monthly_price_eur: 199,
    tagline: "Operate a multi-persona portfolio at agency level.",
    outcomes: [
      "Unlimited personas + high-output planning",
      "Unlimited generations and regenerations (fair-use)",
      "Portfolio-level campaign operations",
      "Higher included credits + priority media workflows",
      "Scale architecture for top-tier AI influencer teams"
    ],
    limits: { personas: 9999, generation_days: 30 },
    generation_mode: "llm"
  }
];

async function loadPlans(): Promise<Plan[]> {
  try {
    const response = await fetch(`${API_URL}/api/plans`, { cache: "no-store" });
    if (!response.ok) {
      return FALLBACK_PLANS;
    }
    const payload = (await response.json()) as { plans: Plan[] };
    return payload.plans?.length ? payload.plans : FALLBACK_PLANS;
  } catch {
    return FALLBACK_PLANS;
  }
}

export default async function HomePage() {
  const plans = await loadPlans();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 pb-14 pt-5 sm:px-8">
      <section className="panel relative overflow-hidden p-6 sm:p-10">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute -bottom-20 left-14 h-48 w-48 rounded-full bg-lime-300/15 blur-2xl" />

        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">VIDRA BY LEXA AI · AI INFLUENCER OPERATING SYSTEM</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.05] sm:text-6xl">
          Create a profitable AI influencer system, not random prompts.
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-slate-200/90 sm:text-lg">
          Build identity memory, generate coherent monthly content strategy, create media-ready prompts, and run campaign execution from one dashboard.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-black text-slate-950 sm:text-base">
            Start FREE
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-cyan-300/40 px-5 py-2.5 text-sm font-black text-cyan-100 sm:text-base">
            Open Dashboard
          </Link>
          <Link href="/blog" className="rounded-xl border border-lime-300/40 px-5 py-2.5 text-sm font-black text-lime-100 sm:text-base">
            Read Blog
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-wider text-cyan-200">Planning Speed</p>
            <p className="mt-1 text-sm text-slate-100">Build and ship monthly calendars in minutes, not hours.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-wider text-lime-200">Identity Coherence</p>
            <p className="mt-1 text-sm text-slate-100">Persona DNA keeps wardrobe, look, and story continuity aligned.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-wider text-orange-200">Monetization Focus</p>
            <p className="mt-1 text-sm text-slate-100">Upgrade into conversion-oriented hooks, campaigns, and media scale.</p>
          </article>
        </div>
      </section>

      <section className="panel p-5 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">How It Works</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-4">
            <p className="text-xs font-bold text-cyan-100">Step 1</p>
            <h3 className="mt-1 text-lg font-black">Design Persona Memory</h3>
            <p className="mt-2 text-sm text-slate-200">Generate profile DNA, wardrobe logic, beauty styles, world events, and prompt blueprints.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-4">
            <p className="text-xs font-bold text-cyan-100">Step 2</p>
            <h3 className="mt-1 text-lg font-black">Run Monthly Strategy</h3>
            <p className="mt-2 text-sm text-slate-200">Create day-by-day calendar output with post ideas, captions, and coherent carousel prompts.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-4">
            <p className="text-xs font-bold text-cyan-100">Step 3</p>
            <h3 className="mt-1 text-lg font-black">Generate and Scale Media</h3>
            <p className="mt-2 text-sm text-slate-200">Use image generation workflows with credits and edit chains for consistent carousel narratives.</p>
          </article>
        </div>
      </section>

      <section className="panel p-5 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">FREE · PRO · MAX</p>
            <h2 className="mt-2 text-2xl font-black sm:text-4xl">Choose your operating tier</h2>
          </div>
          <Link href="/signup" className="hidden rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-100 sm:inline-block">
            Create account
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-cyan-300/30 bg-slate-950/55 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">{plan.name}</h3>
                <p className="text-sm font-bold text-cyan-100">€{plan.monthly_price_eur}/mo</p>
              </div>
              <p className="mt-2 text-sm text-slate-200/90">{plan.tagline}</p>

              <div className="mt-3 rounded-lg border border-cyan-300/20 bg-slate-900/70 p-2 text-xs text-slate-200">
                Unlimited calendar generation/regeneration (fair-use) · {formatLimit(plan.entitlements?.personas_limit ?? plan.limits.personas)} persona(s) ·{" "}
                {plan.entitlements?.generation_days_per_run ?? plan.limits.generation_days} days per run ·{" "}
                {plan.entitlements?.included_credits_monthly ?? 0} monthly credits
              </div>

              <ul className="mt-3 space-y-2 text-sm text-slate-100">
                {plan.outcomes.map((item) => (
                  <li key={item} className="rounded-md border border-cyan-300/15 bg-slate-950/35 px-2 py-1">
                    {item}
                  </li>
                ))}
              </ul>

              <Link href="/signup" className="mt-4 inline-block rounded-lg bg-cyan-400 px-3 py-2 text-sm font-black text-slate-950">
                Start {plan.name}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-5 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Why Vidra Wins</p>
        <h2 className="mt-2 text-2xl font-black sm:text-4xl">What schedulers and generators alone do not solve</h2>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-cyan-100">
                <th className="px-3 py-2">Capability</th>
                <th className="px-3 py-2">Basic Schedulers</th>
                <th className="px-3 py-2">Image Tools</th>
                <th className="px-3 py-2">Vidra by Lexa AI</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-cyan-300/20">
                <td className="px-3 py-2">Persistent persona memory</td>
                <td className="px-3 py-2 text-slate-300">No</td>
                <td className="px-3 py-2 text-slate-300">No</td>
                <td className="px-3 py-2 text-lime-100">Yes</td>
              </tr>
              <tr className="border-t border-cyan-300/20">
                <td className="px-3 py-2">Monthly strategy + daily execution</td>
                <td className="px-3 py-2 text-slate-300">Partial</td>
                <td className="px-3 py-2 text-slate-300">No</td>
                <td className="px-3 py-2 text-lime-100">Yes</td>
              </tr>
              <tr className="border-t border-cyan-300/20">
                <td className="px-3 py-2">Coherent carousel edit chain prompts</td>
                <td className="px-3 py-2 text-slate-300">No</td>
                <td className="px-3 py-2 text-slate-300">Partial</td>
                <td className="px-3 py-2 text-lime-100">Yes</td>
              </tr>
              <tr className="border-t border-cyan-300/20">
                <td className="px-3 py-2">Credits + BYOK hybrid monetization</td>
                <td className="px-3 py-2 text-slate-300">No</td>
                <td className="px-3 py-2 text-slate-300">No</td>
                <td className="px-3 py-2 text-lime-100">Yes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-5 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Trust Layer</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3 text-sm text-slate-100">
            Built and operated as <span className="font-bold text-cyan-100">Vidra by Lexa AI</span> with Stripe billing and self-host deployment compatibility.
          </p>
          <div className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3 text-sm text-slate-100">
            Legal baseline included: Terms, Privacy, Cookies policies and consent preference controls.
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Link href="/legal/terms" className="text-cyan-100 underline">Terms</Link>
              <Link href="/legal/privacy" className="text-cyan-100 underline">Privacy</Link>
              <Link href="/legal/cookies" className="text-cyan-100 underline">Cookies</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
