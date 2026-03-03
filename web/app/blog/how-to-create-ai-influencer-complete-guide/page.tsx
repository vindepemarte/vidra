import Link from "next/link";

const features = [
  {
    icon: "🧬",
    title: "Persona Core",
    description:
      "Define name, handle, age, gender, city, niche, and vibe. This seed drives every downstream generation.",
  },
  {
    icon: "⚙️",
    title: "Async Profile Build",
    description:
      "Vidra builds persona intelligence in background (bio, backstory, style DNA, world context, prompt blueprint) with live status.",
  },
  {
    icon: "🧠",
    title: "Memory Layers",
    description:
      "Narrative + Style + World are reused across calendar and media, so content stays coherent over time.",
  },
  {
    icon: "📅",
    title: "Calendar Engine",
    description:
      "Generate and regenerate calendars with fair-use guardrails. Current engine outputs 6 posts per day.",
  },
  {
    icon: "🎨",
    title: "Media Studio",
    description:
      "Generate, edit, and upscale images from calendar posts. Attach persona LoRA and keep outputs linked to persona history.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create Persona Core",
    time: "1-2 min",
    description: "Set the core identity fields that anchor the full system.",
    details: [
      "Name and public handle",
      "Age and gender",
      "City and niche",
      "Vibe and creator angle",
    ],
  },
  {
    number: "02",
    title: "Build Persona Profile (Async)",
    time: "Variable",
    description: "Start profile build and monitor live status until READY.",
    details: [
      "FREE -> offline profile mode",
      "PRO/MAX -> LLM profile mode (OpenRouter)",
      "Status panel with progress, step, elapsed and ETA",
      "Calendar and Media unlock only when profile is READY",
    ],
  },
  {
    number: "03",
    title: "Validate Narrative + Style + World",
    time: "2-5 min",
    description: "Review generated memory blocks and lock consistency before scaling output.",
    details: [
      "Narrative arc and strategic direction",
      "Physical/style/wardrobe or grooming blocks",
      "World events and carousel continuity rules",
      "Master image prompt blueprint",
    ],
  },
  {
    number: "04",
    title: "Generate Calendar",
    time: "< 1 min",
    description: "Create month content plan from persona memory and chosen month/year.",
    details: [
      "6 posts/day in current engine",
      "FREE: up to 7 days per run",
      "PRO/MAX: up to 30 days per run",
      "Unlimited generations/regenerations (fair-use)",
    ],
  },
  {
    number: "05",
    title: "Produce Media + Publish",
    time: "On demand",
    description: "Use Media Studio on top of calendar prompts, then publish externally.",
    details: [
      "Generate/Edit/Upscale operations",
      "Model routing per provider",
      "Credits wallet + ledger tracking",
      "Assets persist and remain linked to persona",
    ],
  },
];

const tiers = [
  {
    name: "FREE",
    price: "€0",
    period: "forever",
    highlight: false,
    features: [
      "1 persona",
      "7 days per calendar run",
      "Unlimited generation/regeneration (fair-use)",
      "Offline profile + calendar generation",
      "No external API cost required",
    ],
  },
  {
    name: "PRO",
    price: "€29",
    period: "/month",
    highlight: true,
    badge: "Growth",
    features: [
      "10 personas",
      "30 days per calendar run",
      "LLM profile generation via OpenRouter",
      "500 included monthly credits",
      "Advanced media workflow (generate/edit/upscale)",
    ],
  },
  {
    name: "MAX",
    price: "€199",
    period: "/month",
    highlight: false,
    features: [
      "Unlimited personas",
      "30 days per calendar run",
      "LLM profile generation + scale operations",
      "2500 included monthly credits",
      "Portfolio-level throughput",
    ],
  },
];

const examplePersona = `Name: Sofia Rossi
Handle: @sofia.rossi.ai
Age: 26
Gender: Female
City: Milan, Italy
Niche: Fashion & Lifestyle
Vibe: Elegant, bold, authentic`;

const examplePrompt = `Sofia Rossi, 26, Milan creator identity locked.
UGC-first smartphone shot, ambient natural light,
slight grain, candid half-face framing.
Scene: cafe table, city background, realistic social-feed look.
Outfit cue from style DNA: neutral blazer + denim.
Narrative cue: planning a capsule launch.
Keep coherence with prior identity and world context.`;

const exampleDay = `Day theme: Momentum Monday
Mood: focused

Posts (current engine):
  08:30 - hero-post
  11:00 - carousel-sequence
  13:30 - story-sequence
  16:00 - reel-concept
  19:00 - niche-tip
  21:30 - community-prompt`;

export default function BlogPostPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
      <section className="panel p-6 sm:p-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          <span>📖</span>
          <span>Complete Guide</span>
        </div>

        <h1 className="text-3xl font-black sm:text-5xl lg:text-6xl">
          How to Create an <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">AI Influencer</span>
          <br />
          with Vidra by Lexa AI
        </h1>

        <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
          If you want repeatable results, you need a system, not random prompts. This guide follows the real Vidra pipeline used in production.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span>March 3, 2026</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-2">
            <span>⏱️</span>
            <span>10 min read</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-2">
            <span>🧠</span>
            <span>Vidra by Lexa AI</span>
          </div>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">⚠️</span>
          Why Most AI Influencer Projects Fail
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="subpanel border-red-400/30 bg-red-500/5 p-4">
            <p className="text-sm font-bold text-red-300">❌ Random Workflow</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>• No persona memory</li>
              <li>• Inconsistent visuals</li>
              <li>• No world/story continuity</li>
              <li>• Manual chaos every week</li>
            </ul>
          </div>

          <div className="subpanel border-emerald-400/30 bg-emerald-500/5 p-4">
            <p className="text-sm font-bold text-emerald-300">✅ System Workflow</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>• Structured persona intelligence</li>
              <li>• Calendar from memory layers</li>
              <li>• Media linked to calendar posts</li>
              <li>• Persistent assets + credit control</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">🚀</span>
          What Vidra Actually Does
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="subpanel p-4 transition-all hover:border-cyan-400/40">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{feature.icon}</span>
                <span className="font-bold text-white">{feature.title}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">🗺️</span>
          Step-by-Step Execution
        </h2>

        <div className="mt-6 space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="subpanel p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-lg font-black text-cyan-300">
                  {step.number}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{step.title}</h3>
                    <span className="rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">⏱️ {step.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{step.description}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {step.details.map((detail) => (
                      <div key={detail} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="text-cyan-400">→</span>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">🧬</span>
          Example Persona Core
        </h2>
        <div className="data-scroll mt-6 font-mono text-xs text-slate-300 sm:text-sm">
          <pre className="whitespace-pre-wrap">{examplePersona}</pre>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">📅</span>
          Example Calendar Day
        </h2>
        <div className="data-scroll mt-6 font-mono text-xs text-slate-300 sm:text-sm">
          <pre className="whitespace-pre-wrap">{exampleDay}</pre>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">🎨</span>
          Example Media Prompt (UGC-first)
        </h2>
        <div className="data-scroll mt-6 font-mono text-xs text-slate-300 sm:text-sm">
          <pre className="whitespace-pre-wrap">{examplePrompt}</pre>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="text-2xl">💎</span>
          Free, Pro, Max at a Glance
        </h2>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.name} className={`subpanel p-5 ${tier.highlight ? "border-cyan-400/50 bg-cyan-500/5" : ""}`}>
              {tier.badge ? (
                <div className="mb-3 inline-block rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-1 text-xs font-bold text-white">
                  {tier.badge}
                </div>
              ) : null}

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{tier.price}</span>
                <span className="text-sm text-slate-500">{tier.period}</span>
              </div>
              <div className="mt-1 text-lg font-bold text-slate-300">{tier.name}</div>

              <ul className="mt-4 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="mt-0.5 text-cyan-400">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="panel border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6 text-center sm:p-10">
        <h2 className="text-2xl font-black sm:text-3xl">Build the system first. Scale output second.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
          Vidra by Lexa AI is built to keep persona identity, planning, and media execution connected in one operating workflow.
        </p>
        <div className="mt-6">
          <Link
            href="https://vidra.life"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-bold text-white"
          >
            <span>🚀</span>
            <span>Start Free on Vidra.life</span>
          </Link>
        </div>
      </section>

      <Link href="/blog" className="mx-auto inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 px-4 py-2 text-xs font-bold text-cyan-100">
        <span>←</span>
        <span>Back to blog</span>
      </Link>
    </main>
  );
}
