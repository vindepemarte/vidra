"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Gift } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [showReferralBonus, setShowReferralBonus] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref.toUpperCase());
      setShowReferralBonus(true);
    }
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const body: { name: string; email: string; password: string; referral_code?: string } = {
      name,
      email,
      password,
    };

    if (referralCode) {
      body.referral_code = referralCode;
    }

    const signup = await fetch(`/api/internal/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!signup.ok) {
      const data = await signup.json().catch(() => ({}));
      setError(data.detail || "Cannot create account");
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
        
        {/* Referral Bonus Banner */}
        {showReferralBonus && (
          <div className="mt-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-3 flex items-center gap-3">
            <Gift className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">You got referred!</p>
              <p className="text-xs text-gray-300">You'll receive 50 bonus credits on signup</p>
            </div>
          </div>
        )}
        
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
          
          {/* Optional referral code input */}
          {!showReferralBonus && (
            <details className="group">
              <summary className="text-xs text-cyan-300 cursor-pointer hover:text-cyan-200 list-none flex items-center gap-1">
                <span className="group-open:hidden">+ Have a referral code?</span>
                <span className="hidden group-open:inline">− Hide referral code</span>
              </summary>
              <input
                type="text"
                value={referralCode || ""}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="mt-2 w-full rounded-xl border border-purple-500/35 bg-slate-950/70 px-3 py-2 font-mono text-sm"
                placeholder="Enter referral code"
                maxLength={8}
              />
            </details>
          )}
          
          {/* Hidden field for referral code from URL */}
          {referralCode && (
            <input type="hidden" value={referralCode} />
          )}
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
