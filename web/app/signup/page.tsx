"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const signup = await fetch(`/api/internal/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    if (!signup.ok) {
      setError("Cannot create account");
      return;
    }

    await signIn("credentials", { email, password, redirect: false });
    router.push("/studio");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <form onSubmit={onSubmit} className="panel w-full p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">Vidra by Lexa AI</p>
        <h1 className="mt-1 text-2xl font-black">Create account</h1>
        <p className="mt-1 text-sm text-slate-300">Start with FREE forever and scale when ready.</p>
        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-cyan-200/35 bg-slate-950/70 px-3 py-2"
            placeholder="Name"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-cyan-200/35 bg-slate-950/70 px-3 py-2"
            placeholder="Email"
          />
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-cyan-200/35 bg-slate-950/70 px-3 py-2"
            placeholder="Password (min 8)"
          />
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <button className="mt-4 w-full rounded-xl bg-cyan-400 py-2 font-bold text-slate-950" type="submit">
          Create and enter
        </button>
        <p className="mt-3 text-xs text-slate-300">
          Already have an account? <Link href="/login" className="text-cyan-100 underline">Login</Link>
        </p>
      </form>
    </main>
  );
}
