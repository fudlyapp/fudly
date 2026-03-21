// src/app/pricing/PricingClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Tier = "basic" | "plus";
type SubStatus = "none" | "basic" | "plus";

type Entitlements = {
  plan: "basic" | "plus" | null;
  status: string;
  active_like: boolean;
  can_generate: boolean;
  weekly_limit: number;
  used: number;
  remaining: number;
  calories_enabled: boolean;
  allowed_styles: string[];
  trial_until: string | null;
  current_period_end: string | null;
  has_stripe_link: boolean;
};

const CHECKOUT_ENDPOINT = "/api/stripe/create_checkout_session";
const PORTAL_ENDPOINT = "/api/stripe/portal";
const FINALIZE_CHECKOUT_ENDPOINT = "/api/stripe/finalize_checkout";
const CURRENT_SUBSCRIPTION_ENDPOINT = "/api/stripe/current_subscription";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs font-semibold muted">
      {children}
    </span>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm muted">
      <span className="mt-[2px]">•</span>
      <span>{children}</span>
    </li>
  );
}

function Card({
  badge,
  title,
  subtitle,
  price,
  period,
  features,
  highlighted,
  cta,
  ctaNote,
}: {
  badge?: string;
  title: string;
  subtitle: string;
  price: string;
  period: string;
  features: React.ReactNode[];
  highlighted?: boolean;
  cta: React.ReactNode;
  ctaNote?: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl p-6 surface-same-as-nav surface-border",
        highlighted ? "ring-1 ring-black/10 dark:ring-white/10" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {badge ? (
            <div className="mb-3">
              <Pill>{badge}</Pill>
            </div>
          ) : null}
          <div className="text-xl font-semibold">{title}</div>
          <div className="mt-1 text-sm muted">{subtitle}</div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold">{price}</div>
          <div className="text-xs muted-2">{period}</div>
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {features.map((f, i) => (
          <Feature key={i}>{f}</Feature>
        ))}
      </ul>

      <div className="mt-6">
        {cta}
        {ctaNote ? <div className="mt-2 text-xs muted-2 text-center">{ctaNote}</div> : null}
      </div>
    </div>
  );
}

function normalizeSubStatusFromEnt(ent: Entitlements | null): SubStatus {
  if (!ent) return "none";
  if (!ent.has_stripe_link) return "none";
  if (ent.plan === "plus") return "plus";
  if (ent.plan === "basic") return "basic";
  return "none";
}

function displayStatus(status: string) {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "inactive":
      return "inactive";
    case "none":
      return "none";
    default:
      return status;
  }
}

export default function PricingClient() {
  const sp = useSearchParams();

  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [subStatus, setSubStatus] = useState<SubStatus>("none");

  const [busy, setBusy] = useState<null | "basic" | "plus" | "portal">(null);

  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  function applyEntitlement(e: Entitlements | null) {
    setEnt(e);
    setSubStatus(normalizeSubStatusFromEnt(e));
  }

  useEffect(() => {
    const success = sp.get("success");
    const canceled = sp.get("canceled");
    const portal = sp.get("portal");

    if (success === "1") {
      setMsg({
        type: "success",
        text: "✅ Platba prebehla. Aktivujem členstvo…",
      });
    } else if (portal === "1") {
      setMsg({
        type: "info",
        text: "Predplatné bolo aktualizované. Obnovujem stav členstva…",
      });
    } else if (canceled === "1") {
      setMsg({
        type: "info",
        text: "Platba bola zrušená. Ak chceš, skús to znova.",
      });
    } else {
      setMsg(null);
    }
  }, [sp]);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setLoggedIn(!!data.session?.user);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user);
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function getTokenOrLogin(withBuy?: Tier) {
    if (!supabase) return null;

    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;

    if (!token) {
      const buy = withBuy ? `?buy=${encodeURIComponent(withBuy)}` : "";
      window.location.href = `/login?mode=login&next=${encodeURIComponent("/pricing" + buy)}`;
      return null;
    }

    return token;
  }

  async function fetchCurrentSubscriptionRaw(token: string): Promise<Entitlements | null> {
    const res = await fetch(CURRENT_SUBSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;
    return data as Entitlements;
  }

  async function fetchEntitlementsOnce(): Promise<Entitlements | null> {
    if (!supabase) return null;

    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;

    if (!token) {
      applyEntitlement(null);
      return null;
    }

    const res = await fetch(`/api/entitlements?t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    // 1) ak entitlements vrátia validný plán, použi ho
    if (res.ok && data) {
      const e = data as Entitlements;

      if (e.plan !== null && e.status !== "none") {
        applyEntitlement(e);
        return e;
      }
    }

    // 2) fallback: entitlements sú flaky -> zober live Stripe stav
    const live = await fetchCurrentSubscriptionRaw(token);
    if (live && live.plan !== null && live.status !== "none") {
      applyEntitlement(live);
      return live;
    }

    applyEntitlement(null);
    return null;
  }

  async function finalizeCheckout(sessionId: string): Promise<Entitlements | null> {
    if (!supabase) return null;

    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;

    if (!token) return null;

    const res = await fetch(FINALIZE_CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: JSON.stringify({ session_id: sessionId }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;

    const e = data as Entitlements;
    applyEntitlement(e);
    return e;
  }

  async function fetchCurrentSubscriptionFromStripe(): Promise<Entitlements | null> {
    if (!supabase) return null;

    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;

    if (!token) return null;

    const live = await fetchCurrentSubscriptionRaw(token);
    if (live) {
      applyEntitlement(live);
      return live;
    }

    return null;
  }

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    (async () => {
      if (!loggedIn) {
        applyEntitlement(null);
        return;
      }

      try {
        await fetchEntitlementsOnce();
      } catch {
        if (mounted) {
          applyEntitlement(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loggedIn, supabase]);

  useEffect(() => {
    if (!supabase) return;
    if (!loggedIn) return;

    const success = sp.get("success");
    const portal = sp.get("portal");
    const sessionId = sp.get("session_id");

    if (success !== "1" && portal !== "1") return;

    let stopped = false;
    let timer: number | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    async function poll() {
      if (stopped) return;

      attempts += 1;

      let e: Entitlements | null = null;

      if (success === "1") {
        if (attempts === 1 && sessionId) {
          e = await finalizeCheckout(sessionId);
        } else {
          e = await fetchEntitlementsOnce();
        }
      } else {
        e = await fetchCurrentSubscriptionFromStripe();
      }

      const ready =
        !!e &&
        !!e.has_stripe_link &&
        e.plan !== null &&
        e.active_like === true;

      if (ready || attempts >= maxAttempts) return;

      timer = window.setTimeout(() => {
        void poll();
      }, 1200);
    }

    timer = window.setTimeout(() => {
      void poll();
    }, 250);

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [loggedIn, sp, supabase]);

  async function startCheckout(plan: Tier) {
    setMsg(null);

    const token = await getTokenOrLogin(plan);
    if (!token) return;

    setBusy(plan);
    try {
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        setMsg({
          type: "error",
          text: `Nepodarilo sa spustiť platbu. (${data?.error ?? `HTTP ${res.status}`})`,
        });
        return;
      }

      const url = data?.url;
      if (!url) {
        setMsg({
          type: "error",
          text: "Nepodarilo sa spustiť platbu. (Chýba url v odpovedi servera.)",
        });
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      setMsg({
        type: "error",
        text: `Nepodarilo sa spustiť platbu. (${e?.message ?? "unknown"})`,
      });
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setMsg(null);

    if (!ent?.has_stripe_link) {
      setMsg({
        type: "error",
        text: "Správa predplatného nie je dostupná (chýba Stripe väzba). Najprv si kúp plán.",
      });
      return;
    }

    const token = await getTokenOrLogin();
    if (!token) return;

    setBusy("portal");
    try {
      const res = await fetch(PORTAL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        setMsg({
          type: "error",
          text: `Nepodarilo sa otvoriť Stripe portal. (${data?.error ?? `HTTP ${res.status}`})`,
        });
        return;
      }

      const url = data?.url;
      if (!url) {
        setMsg({ type: "error", text: "Nepodarilo sa otvoriť Stripe portal. (Chýba url.)" });
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      setMsg({
        type: "error",
        text: `Nepodarilo sa otvoriť Stripe portal. (${e?.message ?? "unknown"})`,
      });
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!supabase) return;

    const buy = sp.get("buy");
    if (!loggedIn) return;
    if (buy !== "basic" && buy !== "plus") return;

    const url = new URL(window.location.href);
    url.searchParams.delete("buy");
    window.history.replaceState({}, "", url.toString());

    void startCheckout(buy);
  }, [loggedIn, sp, supabase]);

  const buttonBase =
    "w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
  const btnPrimary = "btn-primary " + buttonBase;
  const btnSecondary =
    buttonBase + " border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900";

  const isBasic = subStatus === "basic";
  const isPlus = subStatus === "plus";
  const isNone = subStatus === "none";

  const planLabel = ent?.plan ? ent.plan.toUpperCase() : "ŽIADNY";

  const basicCta = isPlus ? (
    <button type="button" className={btnSecondary} disabled>
      Aktívny plán: PLUS
    </button>
  ) : isBasic ? (
    <button type="button" className={btnPrimary} disabled={busy !== null} onClick={openPortal}>
      {busy === "portal" ? "Otváram…" : "Spravovať predplatné"}
    </button>
  ) : (
    <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => startCheckout("basic")}>
      {busy === "basic" ? "Presmerúvam…" : loggedIn ? "Zakúpiť BASIC" : "Prihlásiť sa a kúpiť BASIC"}
    </button>
  );

  const plusCta = isPlus ? (
    <button type="button" className={btnPrimary} disabled={busy !== null} onClick={openPortal}>
      {busy === "portal" ? "Otváram…" : "Spravovať predplatné"}
    </button>
  ) : isBasic ? (
    <button type="button" className={btnPrimary} disabled={busy !== null} onClick={openPortal}>
      {busy === "portal" ? "Otváram…" : "Prejsť na PLUS"}
    </button>
  ) : (
    <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => startCheckout("plus")}>
      {busy === "plus" ? "Presmerúvam…" : loggedIn ? "Zakúpiť PLUS" : "Prihlásiť sa a kúpiť PLUS"}
    </button>
  );

  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8">
          <div className="text-sm muted-2">Členstvá</div>
          <h1 className="mt-2 text-3xl font-bold">Vyber si plán</h1>
          <div className="mt-2 text-sm muted">14 dní zdarma • Zrušíš kedykoľvek</div>

          {loggedIn ? (
            <div className="mt-3 text-xs muted-2">
              Aktuálny plán: <span className="font-semibold">{planLabel}</span>
              {ent?.status ? (
                <>
                  {" "}
                  • stav: <span className="font-semibold">{displayStatus(ent.status)}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </header>

        {!supabase || checkingAuth ? (
          <div className="mb-6 rounded-2xl p-4 surface-same-as-nav surface-border text-sm muted">
            Načítavam…
          </div>
        ) : null}

        {msg ? (
          <div
            className={[
              "mb-6 rounded-2xl p-4 surface-same-as-nav surface-border text-sm",
              msg.type === "success" ? "text-green-600 dark:text-green-400" : "",
              msg.type === "error" ? "text-red-500" : "",
              msg.type === "info" ? "muted" : "",
            ].join(" ")}
          >
            {msg.text}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title="Basic"
            subtitle="Pre rýchly štart"
            price="9 €"
            period="mesačne"
            features={[
              "3 generovania týždenne",
              "Jedálniček + nákupný zoznam",
              "Recepty ku všetkým jedlám",
              "Uloženie do profilu",
            ]}
            cta={basicCta}
            ctaNote={isNone ? "14 dní zdarma • Zrušíš kedykoľvek" : "Správa prebieha cez Stripe"}
          />

          <Card
            badge="Odporúčané"
            title="Plus"
            subtitle="Pre maximum pohodlia"
            price="13 €"
            period="mesačne"
            highlighted
            features={[
              "5 generovaní týždenne",
              "Viac štýlov (Fit / Tradičné / Exotické)",
              "Kalórie na osobu",
              "Finančný prehľad",
            ]}
            cta={plusCta}
            ctaNote={isNone ? "14 dní zdarma • Zrušíš kedykoľvek" : "Správa prebieha cez Stripe"}
          />
        </div>
      </div>
    </main>
  );
}