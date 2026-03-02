import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="panel mb-6 p-5 sm:p-7">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Vidra OS</p>
        <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">Build your AI influencer empire.</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-200/85 sm:text-base">
          Mobile-first platform for persona design, offline calendar generation, and premium growth loops.
        </p>
        <div className="mt-5 flex gap-3">
          <Link href="/signup" className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950">
            Start Free
          </Link>
          <Link href="/login" className="rounded-xl border border-cyan-300/40 px-4 py-2 font-bold text-cyan-100">
            Login
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="panel p-4">
          <h2 className="font-bold text-cyan-200">FREE Forever</h2>
          <p className="mt-2 text-sm text-slate-200/85">100% Python offline generation, zero API costs.</p>
        </article>
        <article className="panel p-4">
          <h2 className="font-bold text-lime-200">PRO</h2>
          <p className="mt-2 text-sm text-slate-200/85">LLM optimization, trend signals, better conversion outputs.</p>
        </article>
        <article className="panel p-4">
          <h2 className="font-bold text-orange-200">MAX</h2>
          <p className="mt-2 text-sm text-slate-200/85">Multi-persona orchestration and advanced automation playbooks.</p>
        </article>
      </section>
    </main>
  );
}
