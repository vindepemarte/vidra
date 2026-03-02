"use client";

import { useState } from "react";

const POLICY_VERSION = process.env.NEXT_PUBLIC_APP_POLICY_VERSION || "1.0";
const LAST_UPDATED = "March 2, 2026";

export default function CookiesPage() {
  const [lang, setLang] = useState<"en" | "it">("en");

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6">
      <section className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">Cookie Policy</h1>
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => setLang("en")} className={`rounded-md px-3 py-1 ${lang === "en" ? "bg-cyan-400 text-slate-950" : "border border-cyan-300/40 text-cyan-100"}`}>
              EN
            </button>
            <button type="button" onClick={() => setLang("it")} className={`rounded-md px-3 py-1 ${lang === "it" ? "bg-cyan-400 text-slate-950" : "border border-cyan-300/40 text-cyan-100"}`}>
              IT
            </button>
          </div>
        </div>

        {lang === "en" ? (
          <div className="mt-4 space-y-3 text-sm text-slate-100">
            <p><strong>Essential cookies:</strong> required for authentication, session continuity, and security.</p>
            <p><strong>Analytics cookies:</strong> optional, used to measure onboarding and product improvement.</p>
            <p><strong>Marketing cookies:</strong> optional, reserved for future campaign attribution workflows.</p>
            <p><strong>Consent management:</strong> users can accept/reject optional cookies and update preferences anytime via cookie settings.</p>
            <p><strong>Legal basis:</strong> non-essential cookies are processed only with consent.</p>
            <p><strong>Version:</strong> {POLICY_VERSION} · Last update: {LAST_UPDATED}.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-slate-100">
            <p><strong>Cookie essenziali:</strong> necessari per autenticazione, continuità sessione e sicurezza.</p>
            <p><strong>Cookie analytics:</strong> opzionali, usati per misurare onboarding e migliorare il prodotto.</p>
            <p><strong>Cookie marketing:</strong> opzionali, riservati a future funzioni di attribuzione campagne.</p>
            <p><strong>Gestione consenso:</strong> gli utenti possono accettare/rifiutare cookie opzionali e aggiornare preferenze in qualsiasi momento dalle impostazioni cookie.</p>
            <p><strong>Base giuridica:</strong> i cookie non essenziali sono trattati solo con consenso.</p>
            <p><strong>Versione:</strong> {POLICY_VERSION} · Ultimo aggiornamento: 2 marzo 2026.</p>
          </div>
        )}
      </section>
    </main>
  );
}
