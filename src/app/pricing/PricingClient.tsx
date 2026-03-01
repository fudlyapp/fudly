// src/app/pricing/PricingClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Tier = "basic" | "plus";
type SubStatus = "none" | "basic" | "plus";

type Entitlements = {
  plan: "basic" | "plus";
  status: string;
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

      <ul className="mt-5 space-y-2">{features.map((f, i) => <Feature key={i}>{f}</Feature>)}</ul>

      <div className="mt-6">
        {cta}
        {ctaNote ? <div className="mt-2 text-xs muted-2 text-center">{ctaNote}</div> : null}
      </div>
    </div>
  );
}

function normalizeSubStatusFromEnt(ent: Entitlements | null): SubStatus {
  if (!ent) return "none";
  // ako platné berieme len to, čo server reálne dovolí (konzistentné s /api/generate)
  if (!ent.can_generate) return "none";
  if (!ent.has_stripe_link) return "none";
  return ent.plan === "plus" ? "plus" : "basic";
}

export default function PricingClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const sp = useSearchParams();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [subStatus, setSubStatus] = useState<SubStatus>("none");

  const [busy, setBusy] = useState<null | "basic" | "plus" | "portal">(null);

  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // (A) success/canceled paramy z checkoutu
  useEffect(() => {
    const success = sp.get("success");
    const canceled = sp.get("canceled");

    if (success === "1") {
      setMsg({
        type: "success",
        text: "✅ Platba prebehla. Predplatné sa aktivuje po potvrdení od Stripe. Ak sa stav neprepne hneď, obnov stránku o pár sekúnd.",
      });
    } else if (canceled === "1") {
      setMsg({ type: "info", text: "Platba bola zrušená. Ak chceš, skús to znova." });
    }
  }, [sp]);

  // (B) zisti session
  useEffect(() => {
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
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;

    if (!token) {
      const buy = withBuy ? `?buy=${encodeURIComponent(withBuy)}` : "";
      window.location.href = `/login?mode=login&next=${encodeURIComponent("/pricing" + buy)}`;
      return null;
    }

    return token;
  }

  async function fetchEntitlementsOnce() {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;

    if (!token) {
      setEnt(null);
      setSubStatus("none");
      return;
    }

    const res = await fetch("/api/entitlements", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setEnt(null);
      setSubStatus("none");
      return;
    }

    setEnt(data as Entitlements);
    setSubStatus(normalizeSubStatusFromEnt(data as Entitlements));
  }

  // (C) načítaj entitlements, len ak je user prihlásený
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!loggedIn) {
        setEnt(null);
        setSubStatus("none");
        return;
      }
      try {
        await fetchEntitlementsOnce();
      } catch {
        if (mounted) {
          setEnt(null);
          setSubStatus("none");
        }
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // (C2) po návrate zo Stripe skúsiť refresh (webhook môže dobiehať)
  useEffect(() => {
    const success = sp.get("success");
    if (!loggedIn) return;
    if (success !== "1") return;

    const t1 = window.setTimeout(() => void fetchEntitlementsOnce(), 1500);
    const t2 = window.setTimeout(() => void fetchEntitlementsOnce(), 4500);
    const t3 = window.setTimeout(() => void fetchEntitlementsOnce(), 9000);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, sp]);

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
        setMsg({ type: "error", text: "Nepodarilo sa spustiť platbu. (Chýba url v odpovedi servera.)" });
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      setMsg({ type: "error", text: `Nepodarilo sa spustiť platbu. (${e?.message ?? "unknown"})` });
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setMsg(null);

    // poistka: portal len keď existuje Stripe link (konzistentné s API)
    if (!ent?.has_stripe_link) {
      setMsg({
        type: "error",
        text:
          "Nie je dostupné spravovanie predplatného (chýba Stripe väzba). Ak si práve kúpil plán, skús obnoviť stránku o pár sekúnd.",
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
      setMsg({ type: "error", text: `Nepodarilo sa otvoriť Stripe portal. (${e?.message ?? "unknown"})` });
    } finally {
      setBusy(null);
    }
  }

  // (D) auto-buy po login-e: /pricing?buy=basic|plus
  useEffect(() => {
    const buy = sp.get("buy");
    if (!loggedIn) return;
    if (buy !== "basic" && buy !== "plus") return;

    const url = new URL(window.location.href);
    url.searchParams.delete("buy");
    window.history.replaceState({}, "", url.toString());

    startCheckout(buy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const buttonBase =
    "w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
  const btnPrimary = "btn-primary " + buttonBase;
  const btnSecondary = buttonBase + " border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900";

  const isNoSub = subStatus === "none";
  const isBasic = subStatus === "basic";
  const isPlus = subStatus === "plus";

  const basicCta = isPlus ? (
    <button type="button" className={btnSecondary} disabled={busy !== null} onClick={openPortal}>
      {busy === "portal" ? "Otváram…" : "Prejsť na BASIC"}
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

  const plusCta = isBasic ? (
    <button type="button" className={btnPrimary} disabled={busy !== null} onClick={openPortal}>
      {busy === "portal" ? "Otváram…" : "Prejsť na PLUS"}
    </button>
  ) : isPlus ? (
    <button type="button" className={btnPrimary} disabled={busy !== null} onClick={openPortal}>
      {busy === "portal" ? "Otváram…" : "Spravovať predplatné"}
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
        </header>

        {checkingAuth ? (
          <div className="mb-6 rounded-2xl p-4 surface-same-as-nav surface-border text-sm muted">Načítavam…</div>
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
            ctaNote={isNoSub ? "14 dní zdarma • Zrušíš kedykoľvek" : "Správa prebieha cez Stripe"}
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
            ctaNote={isNoSub ? "14 dní zdarma • Zrušíš kedykoľvek" : "Správa prebieha cez Stripe"}
          />
        </div>
      </div>
    </main>
  );
}