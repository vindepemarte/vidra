import Link from "next/link";

const layers = [
  {
    icon: "1",
    title: "Persona Core",
    detail: "Name, handle, age, gender, city, niche, vibe."
  },
  {
    icon: "2",
    title: "Profile Intelligence",
    detail: "Bio, backstory, strategy, style DNA, world events, carousel rules."
  },
  {
    icon: "3",
    title: "Calendar Orchestration",
    detail: "Month-based plan using persona memory and continuity constraints."
  },
  {
    icon: "4",
    title: "Media Execution",
    detail: "Generate/Edit/Upscale assets from calendar posts with credits governance."
  },
  {
    icon: "5",
    title: "Persistence + Review",
    detail: "Jobs, outputs, and prompts stay attached to persona for iteration."
  },
];

const mistakes = [
  "Treating prompts as one-off requests instead of reusable identity assets.",
  "Generating calendar before profile READY state.",
  "Ignoring world events and then forcing unrelated campaign content.",
  "Mixing visual styles without a locked prompt blueprint.",
  "No asset traceability (can’t reproduce a winning image later).",
];

const vidraFlow = [
  "Create persona core in Dashboard.",
  "Start async profile generation and wait for READY.",
  "Review Narrative + Style DNA + World blocks in Persona Workspace.",
  "Generate month calendar (FREE 7-day run, PRO/MAX 30-day run).",
  "Run Media Studio from calendar posts (image/edit/upscale).",
  "Attach persona LoRA for tighter identity lock when available.",
  "Track credits and outputs; iterate from saved assets.",
];

export default function IdentitySystemPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
      <section className="panel p-6 sm:p-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          <span>🧠</span>
          <span>System Design</span>
        </div>
        <h1 className="text-3xl font-black sm:text-5xl lg:text-6xl">
          How To Build an
          <br />
          <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">AI Influencer Identity System</span>
        </h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
          Content consistency is an architecture problem. Vidra by Lexa AI solves it by connecting persona memory, planning, and media execution in one loop.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <span>📅 March 3, 2026</span>
          <span>·</span>
          <span>Lexa AI Editorial</span>
          <span>·</span>
          <span>8 min read</span>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="text-xl font-bold sm:text-2xl">The 5-Layer Identity Stack</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {layers.map((layer) => (
            <article key={layer.title} className="subpanel p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-black text-cyan-100">
                  {layer.icon}
                </span>
                <h3 className="font-bold text-white">{layer.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-300">{layer.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="text-xl font-bold sm:text-2xl">What breaks identity consistency</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {mistakes.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-rose-300">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="text-xl font-bold sm:text-2xl">Actual Vidra execution flow</h2>
        <div className="mt-4 grid gap-2">
          {vidraFlow.map((step, idx) => (
            <div key={step} className="subpanel p-3 text-sm text-slate-200">
              <span className="mr-2 text-cyan-200">{String(idx + 1).padStart(2, "0")}</span>
              {step}
            </div>
          ))}
        </div>
      </section>

      <section className="panel border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6 text-center sm:p-10">
        <h2 className="text-2xl font-black sm:text-3xl">System &gt; Volume</h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-300">
          If identity is not locked, output volume amplifies inconsistency. Build the stack once, then scale with confidence.
        </p>
        <div className="mt-6">
          <Link href="https://vidra.life" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-bold text-white">
            <span>🚀</span>
            <span>Open Vidra.life</span>
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
