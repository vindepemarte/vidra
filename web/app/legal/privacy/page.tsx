"use client";

import { useState } from "react";

const LEGAL_OWNER = process.env.NEXT_PUBLIC_LEGAL_OWNER || "Lexa AI (Owner details to be configured)";
const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || "legal@vidra.life";
const LEGAL_COUNTRY = process.env.NEXT_PUBLIC_LEGAL_COUNTRY || "Italy";
const POLICY_VERSION = process.env.NEXT_PUBLIC_APP_POLICY_VERSION || "1.0";
const LAST_UPDATED = "March 2, 2026";

export default function PrivacyPage() {
  const [lang, setLang] = useState<"en" | "it">("en");

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6">
      <section className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">Privacy Policy</h1>
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
            <p><strong>Controller:</strong> {LEGAL_OWNER} ({LEGAL_COUNTRY}) · Contact: {LEGAL_EMAIL}</p>
            <p><strong>Data collected:</strong> account info, content prompts, usage events, billing metadata, consent records.</p>
            <p><strong>Purposes:</strong> service delivery, security, billing, fraud prevention, analytics (if consented).</p>
            <p><strong>Legal basis:</strong> contract performance, legal obligations, legitimate interest, and consent for optional cookies.</p>
            <p><strong>Processors:</strong> Stripe, OpenRouter, fal.ai, hosting providers.</p>
            <p><strong>Retention:</strong> account and operational data retained while service account is active, unless legal obligations require longer.</p>
            <p><strong>User rights:</strong> access, correction, deletion, portability, objection, complaint to supervisory authority.</p>
            <p><strong>Transfers:</strong> data may be transferred outside the EEA with adequate safeguards where applicable.</p>
            <p><strong>Policy Version:</strong> {POLICY_VERSION} · Last update: {LAST_UPDATED}.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-slate-100">
            <p><strong>Titolare:</strong> {LEGAL_OWNER} ({LEGAL_COUNTRY}) · Contatto: {LEGAL_EMAIL}</p>
            <p><strong>Dati raccolti:</strong> informazioni account, prompt contenuti, eventi di utilizzo, metadati di fatturazione, record di consenso.</p>
            <p><strong>Finalità:</strong> erogazione servizio, sicurezza, fatturazione, prevenzione frodi, analytics (se consentiti).</p>
            <p><strong>Basi giuridiche:</strong> esecuzione contrattuale, obblighi legali, legittimo interesse, consenso per cookie opzionali.</p>
            <p><strong>Responsabili esterni:</strong> Stripe, OpenRouter, fal.ai, provider hosting.</p>
            <p><strong>Conservazione:</strong> dati account e operativi conservati durante l’attività dell’account, salvo obblighi legali ulteriori.</p>
            <p><strong>Diritti interessato:</strong> accesso, rettifica, cancellazione, portabilità, opposizione, reclamo all’autorità garante.</p>
            <p><strong>Trasferimenti:</strong> possibili trasferimenti extra-SEE con garanzie adeguate ove applicabili.</p>
            <p><strong>Versione policy:</strong> {POLICY_VERSION} · Ultimo aggiornamento: 2 marzo 2026.</p>
          </div>
        )}
      </section>
    </main>
  );
}
