"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [calendar, setCalendar] = useState<CalendarSummary | null>(null);
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

    if (!token) {
      return;
    }

    fetch(`${API_URL}/api/personas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Load personas failed"))))
      .then((rows: Persona[]) => {
        setPersonas(rows);
        if (rows[0]) {
          setSelectedPersonaId(rows[0].id);
        }
      })
      .catch((e) => setError(e.message));
  }, [router, status, token]);

  const tier = useMemo(() => (session?.user?.tier ?? "free").toUpperCase(), [session?.user?.tier]);

  async function createPersona() {
    if (!token) {
      return;
    }
    setError("");

    const res = await fetch(`${API_URL}/api/personas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(form)
    });

    if (!res.ok) {
      setError("Persona creation failed");
      return;
    }

    const created = (await res.json()) as Persona;
    const next = [created, ...personas];
    setPersonas(next);
    setSelectedPersonaId(created.id);
  }

  async function generateMonth() {
    if (!token || !selectedPersonaId) {
      return;
    }

    const res = await fetch(`${API_URL}/api/calendar/${selectedPersonaId}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ month, year })
    });

    if (!res.ok) {
      setError("Calendar generation failed");
      return;
    }

    const data = (await res.json()) as CalendarSummary;
    setCalendar(data);
  }

  if (status === "loading") {
    return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-5">Loading...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <section className="panel p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Control Deck</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">Dashboard</h1>
          <div className="rounded-lg border border-lime-300/50 bg-lime-400/15 px-3 py-1 text-xs font-bold text-lime-100">{tier}</div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="panel p-4">
          <h2 className="text-lg font-bold">Create Persona</h2>
          <div className="mt-3 space-y-2">
            <input className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2" placeholder="Handle" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
            <input className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <button className="w-full rounded-lg bg-cyan-400 py-2 font-bold text-slate-950" onClick={createPersona} type="button">Create</button>
          </div>
        </article>

        <article className="panel p-4">
          <h2 className="text-lg font-bold">Generate FREE Calendar</h2>
          <p className="mt-1 text-xs text-slate-300">Offline Python engine only, zero API calls.</p>
          <div className="mt-3 space-y-2">
            <select className="w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2" value={selectedPersonaId} onChange={(e) => setSelectedPersonaId(e.target.value)}>
              <option value="">Select persona</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input className="w-1/2 rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2" type="number" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
              <input className="w-1/2 rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
            <button className="w-full rounded-lg bg-lime-400 py-2 font-bold text-slate-950" onClick={generateMonth} type="button">Generate</button>
          </div>
        </article>
      </section>

      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}

      {calendar ? (
        <section className="panel p-4">
          <h2 className="text-lg font-bold">{calendar.year}-{String(calendar.month).padStart(2, "0")} | {calendar.mode.toUpperCase()}</h2>
          <p className="mt-1 text-xs text-slate-300">Preview first 3 days</p>
          <div className="mt-3 space-y-3">
            {calendar.days.slice(0, 3).map((d) => (
              <article key={d.day} className="rounded-lg border border-cyan-300/20 p-3">
                <p className="font-semibold">Day {d.day}: {d.theme} ({d.mood})</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-200/90">
                  {d.posts.slice(0, 2).map((p) => (
                    <li key={p.post_number}>[{p.time}] {p.scene_type} - {p.caption}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
