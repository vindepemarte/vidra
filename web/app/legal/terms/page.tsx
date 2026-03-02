"use client";

import { useState } from "react";

const LEGAL_OWNER = process.env.NEXT_PUBLIC_LEGAL_OWNER || "Lexa AI (Owner details to be configured)";
const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || "legal@vidra.life";
const LEGAL_COUNTRY = process.env.NEXT_PUBLIC_LEGAL_COUNTRY || "Italy";
const POLICY_VERSION = process.env.NEXT_PUBLIC_APP_POLICY_VERSION || "1.0";
const LAST_UPDATED = "March 2, 2026";

export default function TermsPage() {
  const [lang, setLang] = useState<"en" | "it">("en");

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6">
      <section className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">Terms & Conditions</h1>
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
            <p><strong>Service:</strong> Vidra by Lexa AI provides planning and workflow tools for AI influencer content operations.</p>
            <p><strong>Owner:</strong> {LEGAL_OWNER} ({LEGAL_COUNTRY}) · Contact: {LEGAL_EMAIL}</p>
            <p><strong>Use of Service:</strong> You are responsible for lawful use of generated outputs and third-party platform compliance.</p>
            <p><strong>Paid Plans and Credits:</strong> Subscription tiers unlock capabilities; media generation may consume credits. Credit balances are non-refundable except where required by law.</p>
            <p><strong>Third-party Providers:</strong> Stripe, OpenRouter, fal.ai and hosting infrastructure may process data to deliver the service.</p>
            <p><strong>Liability:</strong> Service is provided on an as-is basis; indirect damages are excluded where legally permitted.</p>
            <p><strong>Termination:</strong> Access may be suspended for abuse, fraud, or policy violations.</p>
            <p><strong>Policy Version:</strong> {POLICY_VERSION} · Last update: {LAST_UPDATED}.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-slate-100">
            <p><strong>Servizio:</strong> Vidra by Lexa AI fornisce strumenti di pianificazione e workflow per contenuti AI influencer.</p>
            <p><strong>Titolare:</strong> {LEGAL_OWNER} ({LEGAL_COUNTRY}) · Contatto: {LEGAL_EMAIL}</p>
            <p><strong>Uso del servizio:</strong> L’utente è responsabile dell’uso lecito degli output generati e del rispetto delle policy delle piattaforme terze.</p>
            <p><strong>Piani a pagamento e crediti:</strong> I piani in abbonamento sbloccano funzionalità; la generazione media può consumare crediti. I crediti non sono rimborsabili salvo obblighi di legge.</p>
            <p><strong>Fornitori terzi:</strong> Stripe, OpenRouter, fal.ai e infrastruttura hosting possono trattare dati per erogare il servizio.</p>
            <p><strong>Responsabilità:</strong> Il servizio è fornito "as-is"; i danni indiretti sono esclusi nei limiti consentiti dalla legge.</p>
            <p><strong>Risoluzione/Sospensione:</strong> L’accesso può essere sospeso in caso di abuso, frode o violazioni di policy.</p>
            <p><strong>Versione policy:</strong> {POLICY_VERSION} · Ultimo aggiornamento: 2 marzo 2026.</p>
          </div>
        )}
      </section>
    </main>
  );
}
