"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { LogoutButton } from "@/components/logout-button";
import { API_URL } from "@/lib/api";
import { trackEvent } from "@/lib/events";

type MyPlan = {
  current_tier: string;
  next_tier?: string | null;
  personas_limit: number;
  generation_days_limit: number;
  generation_days_per_run?: number;
  generation_mode: string;
  openrouter_enabled?: boolean;
  openrouter_model?: string | null;
  calendar_generations?: string;
  calendar_regenerations?: string;
  media_generation_requires_credits?: boolean;
  credits_balance?: number;
  included_credits?: number;
  included_credits_monthly?: number;
};

type PlanEntitlements = {
  calendar_generations: string;
  calendar_regenerations: string;
  personas_limit: number;
  generation_days_per_run: number;
  included_credits_monthly: number;
  media_generation_requires_credits: boolean;
};

type Plan = {
  id: string;
  name: string;
  monthly_price_eur: number;
  tagline: string;
  outcomes: string[];
  limits: { personas: number; generation_days: number };
  generation_mode: string;
  entitlements?: PlanEntitlements;
};

type CreditWallet = {
  balance_credits: number;
  included_monthly_credits: number;
};

type CreditLedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  source_type: string;
  source_id: string;
  created_at: string;
};

type CreditLedger = {
  entries: CreditLedgerEntry[];
};

type ApiKeyMask = {
  provider: "openrouter" | "fal";
  configured: boolean;
  masked_value?: string | null;
};

type ApiKeyList = {
  keys: ApiKeyMask[];
};

type ModelPreferences = {
  openrouter_model?: string | null;
  fal_image_model?: string | null;
  fal_edit_model?: string | null;
  fal_upscale_model?: string | null;
  fal_train_model?: string | null;
};

type ProviderModelOption = {
  id: string;
  label: string;
  operation: string;
  credits_hint: string;
};

type ProviderModelCatalog = {
  openrouter: ProviderModelOption[];
  fal: ProviderModelOption[];
};

type TopupPack = {
  id: "starter" | "growth" | "scale";
  name: string;
  credits: number;
  price: string;
};

const TOPUP_PACKS: TopupPack[] = [
  { id: "starter", name: "Starter", credits: 500, price: "€7" },
  { id: "growth", name: "Growth", credits: 1500, price: "€19" },
  { id: "scale", name: "Scale", credits: 5000, price: "€59" }
];

function tierRank(tier: string): number {
  if (tier === "max") return 3;
  if (tier === "pro") return 2;
  return 1;
}

async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const payload = JSON.parse(text) as { detail?: string | { message?: string; code?: string; status?: string } };
    if (typeof payload.detail === "string" && payload.detail) return payload.detail;
    if (payload.detail && typeof payload.detail === "object") {
      if (payload.detail.message) return payload.detail.message;
      if (payload.detail.code) return payload.detail.code;
      if (payload.detail.status) return payload.detail.status;
    }
  } catch {
    // no-op
  }
  return text || `Request failed (${res.status})`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;

  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyMask[]>([]);
  const [modelPrefs, setModelPrefs] = useState<ModelPreferences>({
    openrouter_model: "",
    fal_image_model: "",
    fal_edit_model: "",
    fal_upscale_model: "",
    fal_train_model: "",
  });
  const [modelCatalog, setModelCatalog] = useState<ProviderModelCatalog>({ openrouter: [], fal: [] });

  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({ openrouter: "", fal: "" });
  const [loading, setLoading] = useState(true);
  const [busyCheckoutTier, setBusyCheckoutTier] = useState<string | null>(null);
  const [busyPortal, setBusyPortal] = useState(false);
  const [busyTopup, setBusyTopup] = useState<string | null>(null);
  const [busySaveProvider, setBusySaveProvider] = useState<string | null>(null);
  const [busyDeleteProvider, setBusyDeleteProvider] = useState<string | null>(null);
  const [busySaveModelPrefs, setBusySaveModelPrefs] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    async function load() {
      if (!token) return;
      try {
        setLoading(true);
        setError("");

        const [myPlanRes, plansRes, walletRes, ledgerRes, keysRes, modelPrefsRes, providerModelsRes] = await Promise.all([
          fetch(`${API_URL}/api/plans/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/plans`),
          fetch(`${API_URL}/api/credits/wallet`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/credits/ledger`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/account/api-keys`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/account/model-preferences`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/account/provider-models`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (!myPlanRes.ok) throw new Error(await extractErrorMessage(myPlanRes));
        if (!plansRes.ok) throw new Error(await extractErrorMessage(plansRes));
        if (!walletRes.ok) throw new Error(await extractErrorMessage(walletRes));
        if (!ledgerRes.ok) throw new Error(await extractErrorMessage(ledgerRes));
        if (!keysRes.ok) throw new Error(await extractErrorMessage(keysRes));
        if (!modelPrefsRes.ok) throw new Error(await extractErrorMessage(modelPrefsRes));
        if (!providerModelsRes.ok) throw new Error(await extractErrorMessage(providerModelsRes));

        const myPlanData = (await myPlanRes.json()) as MyPlan;
        const plansData = (await plansRes.json()) as { plans: Plan[] };
        const walletData = (await walletRes.json()) as CreditWallet;
        const ledgerData = (await ledgerRes.json()) as CreditLedger;
        const keysData = (await keysRes.json()) as ApiKeyList;
        const prefsData = (await modelPrefsRes.json()) as ModelPreferences;
        const providerModelsData = (await providerModelsRes.json()) as ProviderModelCatalog;

        setMyPlan(myPlanData);
        setPlans(plansData.plans);
        setWallet(walletData);
        setLedger(ledgerData.entries);
        setApiKeys(keysData.keys);
        setModelPrefs({
          openrouter_model: prefsData.openrouter_model || "",
          fal_image_model: prefsData.fal_image_model || "",
          fal_edit_model: prefsData.fal_edit_model || "",
          fal_upscale_model: prefsData.fal_upscale_model || "",
          fal_train_model: prefsData.fal_train_model || "",
        });
        setModelCatalog(providerModelsData);

        const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const billing = query?.get("billing");
        const credits = query?.get("credits");
        if (billing === "success") setSuccess("Subscription checkout completed. Stripe webhook will sync your plan shortly.");
        if (credits === "success") setSuccess("Credit top-up completed. Balance will update after webhook confirmation.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot load settings");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router, status, token]);

  const upgradeOptions = useMemo(() => {
    if (!myPlan) return [] as Plan[];
    return plans.filter((plan) => tierRank(plan.id) > tierRank(myPlan.current_tier));
  }, [plans, myPlan]);

  async function refreshCreditsAndKeys(): Promise<void> {
    if (!token) return;
    const [walletRes, ledgerRes, keysRes, myPlanRes, prefsRes] = await Promise.all([
      fetch(`${API_URL}/api/credits/wallet`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/credits/ledger`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/account/api-keys`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/plans/me`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/account/model-preferences`, { headers: { Authorization: `Bearer ${token}` } })
    ]);

    if (walletRes.ok) setWallet((await walletRes.json()) as CreditWallet);
    if (ledgerRes.ok) setLedger(((await ledgerRes.json()) as CreditLedger).entries);
    if (keysRes.ok) setApiKeys(((await keysRes.json()) as ApiKeyList).keys);
    if (myPlanRes.ok) setMyPlan((await myPlanRes.json()) as MyPlan);
    if (prefsRes.ok) {
      const prefsData = (await prefsRes.json()) as ModelPreferences;
      setModelPrefs({
        openrouter_model: prefsData.openrouter_model || "",
        fal_image_model: prefsData.fal_image_model || "",
        fal_edit_model: prefsData.fal_edit_model || "",
        fal_upscale_model: prefsData.fal_upscale_model || "",
        fal_train_model: prefsData.fal_train_model || "",
      });
    }
  }

  async function startCheckout(targetTier: string) {
    if (!token || busyCheckoutTier) return;

    try {
      setBusyCheckoutTier(targetTier);
      setError("");
      setSuccess("");

      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `${Date.now()}-${targetTier}`
        },
        body: JSON.stringify({ tier: targetTier })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as { url: string };
      await trackEvent("upgrade_clicked", { target_tier: targetTier }, token);
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot open checkout");
      setBusyCheckoutTier(null);
    }
  }

  async function openPortal() {
    if (!token || busyPortal) return;

    try {
      setBusyPortal(true);
      setError("");

      const res = await fetch(`${API_URL}/api/billing/portal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as { url: string };
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot open billing portal");
    } finally {
      setBusyPortal(false);
    }
  }

  async function startTopup(packId: TopupPack["id"]) {
    if (!token || busyTopup) return;

    try {
      setBusyTopup(packId);
      setError("");
      setSuccess("");

      const res = await fetch(`${API_URL}/api/credits/topup/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `${Date.now()}-${packId}`
        },
        body: JSON.stringify({ pack_id: packId })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const payload = (await res.json()) as { url: string };
      await trackEvent("checkout_started", { mode: "topup", pack: packId }, token);
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot open top-up checkout");
      setBusyTopup(null);
    }
  }

  async function saveApiKey(provider: "openrouter" | "fal") {
    if (!token || busySaveProvider) return;

    const value = (keyInputs[provider] || "").trim();
    if (!value) {
      setError(`Enter a ${provider.toUpperCase()} key first.`);
      return;
    }

    try {
      setBusySaveProvider(provider);
      setError("");
      setSuccess("");

      const res = await fetch(`${API_URL}/api/account/api-keys/${provider}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ api_key: value })
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      setSuccess(`${provider.toUpperCase()} key saved.`);
      setKeyInputs((prev) => ({ ...prev, [provider]: "" }));
      await refreshCreditsAndKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save API key");
    } finally {
      setBusySaveProvider(null);
    }
  }

  async function deleteApiKey(provider: "openrouter" | "fal") {
    if (!token || busyDeleteProvider) return;

    try {
      setBusyDeleteProvider(provider);
      setError("");
      setSuccess("");

      const res = await fetch(`${API_URL}/api/account/api-keys/${provider}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      setSuccess(`${provider.toUpperCase()} key removed.`);
      await refreshCreditsAndKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot remove API key");
    } finally {
      setBusyDeleteProvider(null);
    }
  }

  async function saveModelPreferences() {
    if (!token || busySaveModelPrefs) return;

    try {
      setBusySaveModelPrefs(true);
      setError("");
      setSuccess("");

      const payload: ModelPreferences = {
        openrouter_model: modelPrefs.openrouter_model?.trim() || null,
        fal_image_model: modelPrefs.fal_image_model?.trim() || null,
        fal_edit_model: modelPrefs.fal_edit_model?.trim() || null,
        fal_upscale_model: modelPrefs.fal_upscale_model?.trim() || null,
        fal_train_model: modelPrefs.fal_train_model?.trim() || null,
      };

      const res = await fetch(`${API_URL}/api/account/model-preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await extractErrorMessage(res));

      const saved = (await res.json()) as ModelPreferences;
      setModelPrefs({
        openrouter_model: saved.openrouter_model || "",
        fal_image_model: saved.fal_image_model || "",
        fal_edit_model: saved.fal_edit_model || "",
        fal_upscale_model: saved.fal_upscale_model || "",
        fal_train_model: saved.fal_train_model || "",
      });
      await refreshCreditsAndKeys();
      setSuccess("Model preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save model preferences");
    } finally {
      setBusySaveModelPrefs(false);
    }
  }

  if (status === "loading" || loading) {
    return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">Loading settings...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-3 py-5 sm:px-6">
      <section className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">Vidra by Lexa AI</p>
            <h1 className="mt-1 text-2xl font-black">Settings & Billing</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-100"
            >
              Studio
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-100"
            >
              Dashboard
            </Link>
            <LogoutButton />
          </div>
        </div>

        {myPlan ? (
          <div className="mt-3 rounded-lg border border-cyan-300/25 bg-slate-950/55 p-3 text-sm text-slate-100">
            Tier: <span className="font-black">{myPlan.current_tier.toUpperCase()}</span> · Unlimited calendar generations/regenerations (fair-use),{" "}
            {myPlan.personas_limit >= 9999 ? "Unlimited" : myPlan.personas_limit} persona(s),{" "}
            {myPlan.generation_days_per_run ?? myPlan.generation_days_limit} days per run
          </div>
        ) : null}

        {myPlan?.openrouter_model ? (
          <p className="mt-2 text-xs text-cyan-100">Active paid model: {myPlan.openrouter_model}</p>
        ) : myPlan?.current_tier !== "free" ? (
          <p className="mt-2 text-xs text-orange-200">Paid tier active but OpenRouter key is missing, generation can fallback to offline.</p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-4">
          <h2 className="text-lg font-black">Plans</h2>
          <div className="mt-3 grid gap-2">
            {plans.map((plan) => (
              <div key={plan.id} className={`rounded-lg border p-3 ${plan.id === myPlan?.current_tier ? "border-lime-300/50 bg-lime-500/10" : "border-cyan-300/25 bg-slate-950/45"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-black">{plan.name}</p>
                  <p className="text-xs font-bold text-cyan-100">€{plan.monthly_price_eur}/mo</p>
                </div>
                <p className="mt-1 text-xs text-slate-300">{plan.tagline}</p>
                <ul className="mt-2 space-y-1 text-[11px] text-slate-200">
                  <li>Unlimited generations/regenerations (fair-use)</li>
                  <li>
                    Personas: {(plan.entitlements?.personas_limit ?? plan.limits.personas) >= 9999
                      ? "Unlimited"
                      : plan.entitlements?.personas_limit ?? plan.limits.personas}
                  </li>
                  <li>Days per run: {plan.entitlements?.generation_days_per_run ?? plan.limits.generation_days}</li>
                  <li>Included monthly credits: {plan.entitlements?.included_credits_monthly ?? 0}</li>
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {upgradeOptions.length > 0 ? (
              upgradeOptions.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => startCheckout(plan.id)}
                  disabled={busyCheckoutTier !== null}
                  className="rounded-lg bg-orange-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  {busyCheckoutTier === plan.id ? "Opening checkout..." : `Upgrade to ${plan.name}`}
                </button>
              ))
            ) : (
              <p className="rounded-lg border border-lime-300/40 bg-lime-500/10 px-3 py-2 text-sm text-lime-100">MAX active.</p>
            )}

            {myPlan?.current_tier !== "free" ? (
              <button
                type="button"
                onClick={openPortal}
                disabled={busyPortal}
                className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"
              >
                {busyPortal ? "Opening portal..." : "Manage Stripe Billing"}
              </button>
            ) : null}
          </div>
        </article>

        <article className="panel p-4">
          <h2 className="text-lg font-black">Credits Wallet</h2>
          <div className="mt-3 rounded-lg border border-cyan-300/25 bg-slate-950/55 p-3 text-sm text-slate-100">
            Balance: <span className="font-black">{wallet?.balance_credits ?? 0}</span> credits
            <br />
            Included monthly: <span className="font-black">{wallet?.included_monthly_credits ?? 0}</span> credits
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {TOPUP_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => startTopup(pack.id)}
                disabled={busyTopup !== null}
                className="rounded-lg border border-cyan-300/35 bg-slate-950/50 p-3 text-left disabled:opacity-50"
              >
                <p className="font-black">{pack.name}</p>
                <p className="text-xs text-slate-300">{pack.credits} credits</p>
                <p className="mt-1 text-sm font-bold text-cyan-100">{busyTopup === pack.id ? "Opening..." : pack.price}</p>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">Provider Keys (BYOK)</h2>
        <p className="mt-1 text-xs text-slate-300">If a BYOK key is present, Vidra uses it first. Otherwise it uses platform keys and credit billing.</p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {(["openrouter", "fal"] as const).map((provider) => {
            const config = apiKeys.find((item) => item.provider === provider);
            return (
              <article key={provider} className="rounded-lg border border-cyan-300/25 bg-slate-950/50 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black uppercase">{provider}</h3>
                  <p className="text-xs text-slate-300">
                    {config?.configured ? `Configured (${config.masked_value || "****"})` : "Not configured"}
                  </p>
                </div>
                <input
                  type="password"
                  value={keyInputs[provider] || ""}
                  onChange={(e) => setKeyInputs((prev) => ({ ...prev, [provider]: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2"
                  placeholder={`Paste ${provider.toUpperCase()} key`}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveApiKey(provider)}
                    disabled={busySaveProvider !== null}
                    className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                  >
                    {busySaveProvider === provider ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteApiKey(provider)}
                    disabled={busyDeleteProvider !== null}
                    className="rounded-lg border border-red-300/40 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-50"
                  >
                    {busyDeleteProvider === provider ? "Removing..." : "Remove"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">Model Routing</h2>
        <p className="mt-1 text-xs text-slate-300">
          Pick which model to use per operation. If BYOK key is set, these run on your key. Otherwise Vidra uses platform keys and deducts credits with safety margin.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="subpanel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-200">OpenRouter Profile Model</p>
            <select
              className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2 text-sm"
              value={modelPrefs.openrouter_model || ""}
              onChange={(e) => setModelPrefs((prev) => ({ ...prev, openrouter_model: e.target.value }))}
            >
              {modelCatalog.openrouter.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-slate-300">Used for persona/profile LLM generation on PRO/MAX.</p>
          </label>

          <label className="subpanel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-200">FAL Image Model</p>
            <select
              className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2 text-sm"
              value={modelPrefs.fal_image_model || ""}
              onChange={(e) => setModelPrefs((prev) => ({ ...prev, fal_image_model: e.target.value }))}
            >
              {modelCatalog.fal
                .filter((model) => model.operation === "generate")
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · {model.credits_hint}
                  </option>
                ))}
            </select>
          </label>

          <label className="subpanel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-200">FAL Edit Model</p>
            <select
              className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2 text-sm"
              value={modelPrefs.fal_edit_model || ""}
              onChange={(e) => setModelPrefs((prev) => ({ ...prev, fal_edit_model: e.target.value }))}
            >
              {modelCatalog.fal
                .filter((model) => model.operation === "edit")
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · {model.credits_hint}
                  </option>
                ))}
            </select>
          </label>

          <label className="subpanel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-200">FAL Upscale Model</p>
            <select
              className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2 text-sm"
              value={modelPrefs.fal_upscale_model || ""}
              onChange={(e) => setModelPrefs((prev) => ({ ...prev, fal_upscale_model: e.target.value }))}
            >
              {modelCatalog.fal
                .filter((model) => model.operation === "upscale")
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · {model.credits_hint}
                  </option>
                ))}
            </select>
          </label>

          <label className="subpanel p-3 sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-200">FAL LoRA Training Model</p>
            <select
              className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-950/60 px-3 py-2 text-sm"
              value={modelPrefs.fal_train_model || ""}
              onChange={(e) => setModelPrefs((prev) => ({ ...prev, fal_train_model: e.target.value }))}
            >
              {modelCatalog.fal
                .filter((model) => model.operation === "train")
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · {model.credits_hint}
                  </option>
                ))}
            </select>
            <p className="mt-2 text-[11px] text-slate-300">
              Attach your trained LoRA in Persona Workspace. Training jobs can be added next without schema changes.
            </p>
          </label>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={saveModelPreferences}
            disabled={busySaveModelPrefs}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {busySaveModelPrefs ? "Saving..." : "Save Model Routing"}
          </button>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-black">Recent Credit Ledger</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">No credit operations yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="text-slate-300">
                  <th className="py-2">Date</th>
                  <th className="py-2">Delta</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {ledger.slice(0, 12).map((entry) => (
                  <tr key={entry.id} className="border-t border-cyan-300/15">
                    <td className="py-2">{new Date(entry.created_at).toLocaleString()}</td>
                    <td className={`py-2 font-bold ${entry.delta >= 0 ? "text-lime-200" : "text-orange-200"}`}>
                      {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                    </td>
                    <td className="py-2 text-slate-100">{entry.reason}</td>
                    <td className="py-2 text-slate-300">{entry.source_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {success ? <p className="rounded-lg border border-lime-300/40 bg-lime-500/10 p-3 text-sm text-lime-100">{success}</p> : null}
      {error ? <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    </main>
  );
}
