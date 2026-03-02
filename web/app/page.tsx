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
};

const FALLBACK_PLANS: Plan[] = [
  {
    id: "free",
    name: "FREE",
    monthly_price_eur: 0,
    tagline: "Launch your first AI creator and stay consistent every week.",
    outcomes: [
      "1 creator persona",
      "7-day content sprint generation",
      "6 posts/day with captions and prompts",
      "Export-ready output"
    ],
    limits: { personas: 1, generation_days: 7 },
    generation_mode: "offline"
  },
  {
    id: "pro",
    name: "PRO",
    monthly_price_eur: 29,
    tagline: "Turn content into a growth system with AI strategy.",
    outcomes: [
      "Up to 3 personas",
      "30-day calendar generation",
      "AI hooks and CTA optimization",
      "OpenRouter-powered premium planning"
    ],
    limits: { personas: 3, generation_days: 30 },
    generation_mode: "llm"
  },
  {
    id: "max",
    name: "MAX",
    monthly_price_eur: 199,
    tagline: "Operate a creator portfolio at agency scale.",
    outcomes: [
      "Up to 10 personas",
      "Advanced campaign-grade planning",
      "Monetization-focused narrative design",
      "High-intensity AI orchestration"
    ],
    limits: { personas: 10, generation_days: 30 },
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

        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">VIDRA // Creator OS</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] sm:text-6xl">
          Build AI creators that look consistent, grow faster, and convert.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-slate-200/90 sm:text-lg">
          Vidra is your content operating system: create a persona, generate a full execution plan, and run a repeatable growth machine from mobile.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-black text-slate-950 sm:text-base">
            Start Free
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-cyan-300/40 px-5 py-2.5 text-sm font-black text-cyan-100 sm:text-base">
            Open Dashboard
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-wider text-cyan-200">Consistency Engine</p>
            <p className="mt-1 text-sm text-slate-100">Generate daily posting structures instead of guessing what to post.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-wider text-lime-200">Persona Quality</p>
            <p className="mt-1 text-sm text-slate-100">Keep visual identity and narrative coherence across your content calendar.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-wider text-orange-200">Revenue Focus</p>
            <p className="mt-1 text-sm text-slate-100">Upgrade to conversion-first hooks and campaign framing when you scale.</p>
          </article>
        </div>
      </section>

      <section className="panel p-5 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Pricing</p>
            <h2 className="mt-2 text-2xl font-black sm:text-4xl">Choose your operating mode</h2>
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
                Up to {plan.limits.personas} persona(s) · {plan.limits.generation_days} day generation · {plan.generation_mode.toUpperCase()} engine
              </div>

              <ul className="mt-3 space-y-2 text-sm text-slate-100">
                {plan.outcomes.map((item) => (
                  <li key={item} className="rounded-md border border-cyan-300/15 bg-slate-950/35 px-2 py-1">
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="mt-4 inline-block rounded-lg bg-cyan-400 px-3 py-2 text-sm font-black text-slate-950"
              >
                Start {plan.name}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-5 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Why Teams Pick Vidra</p>
        <h2 className="mt-2 text-2xl font-black sm:text-4xl">Not a prompt toy. A creator execution system.</h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/40 p-4">
            <h3 className="font-bold">From chaos to plan</h3>
            <p className="mt-2 text-sm text-slate-200/90">Generate structured content timelines with daily post angles, mood, scenes, and caption direction.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/40 p-4">
            <h3 className="font-bold">Tiered scale path</h3>
            <p className="mt-2 text-sm text-slate-200/90">Start free forever, unlock AI-assisted quality in PRO, then run multi-creator systems in MAX.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/40 p-4">
            <h3 className="font-bold">Mobile-first ops</h3>
            <p className="mt-2 text-sm text-slate-200/90">Create personas, generate calendars, and review outputs directly from your phone.</p>
          </article>
          <article className="rounded-xl border border-cyan-300/20 bg-slate-950/40 p-4">
            <h3 className="font-bold">Own your stack</h3>
            <p className="mt-2 text-sm text-slate-200/90">Self-host on your infrastructure with domain control and direct Stripe billing ownership.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
