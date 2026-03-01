// src/app/pricing/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Tier = "basic" | "plus";
type SubStatus = "none" | "basic" | "plus";

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

/**
 * Snaží sa robustne určiť stav z tabuľky `subscriptions`.
 * Uprav si len túto funkciu, ak máš iné názvy stĺpcov.
 */
function normalizeSubStatus(row: any): SubStatus {
  if (!row) return "none";

  const status = String(row.status ?? row.subscription_status ?? "").toLowerCase();
  const active = status === "active" || status === "trialing";

  // Ak nemáš status, ale máš plan, berieme to ako aktívne (fallback)
  const planRaw = String(row.plan ?? row.tier ?? row.current_plan ?? "").toLowerCase();
  const hasPlan = planRaw === "basic" || planRaw === "plus";

  if (!active && !hasPlan) return "none";

  if (planRaw === "plus") return "plus";
  if (planRaw === "basic") return "basic";

  return "none";
}

export default function PricingPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const sp = useSearchParams();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [subStatus, setSubStatus] = useState<SubStatus>("none");
  const [busy, setBusy] = useState<null | "basic" | "plus" | "portal">(null);

  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // (A) success/canceled paramy z checkoutu
  useEffect(() => {
    const success = sp.get("success");
    const canceled = sp.get("canceled");

    if (success === "1") {
      setMsg({ type: "success", text: "✅ Platba prebehla. Predplatné sa aktivuje po potvrdení od Stripe." });
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

  // (C) načítaj subscription status len ak je user prihlásený
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!loggedIn) {
        setSubStatus("none");
        return;
      }

      try {
        const { data: s } = await supabase.auth.getSession();
        const user = s.session?.user;
        if (!user) {
          setSubStatus("none");
          return;
        }

        const { data, error } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          setSubStatus("none");
          return;
        }

        setSubStatus(normalizeSubStatus(data));
      } catch {
        if (mounted) setSubStatus("none");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase, loggedIn]);

  async function getTokenOrLogin(withBuy?: Tier) {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;

    if (!token) {
      const buy = withBuy ? `&buy=${encodeURIComponent(withBuy)}` : "";
      // UX: vyzerá to ako "kúpim", ale najprv sa musí prihlásiť
      window.location.href = `/login?next=${encodeURIComponent("/pricing" + buy)}`;
      return null;
    }

    return token;
  }

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
        setMsg({ type: "error", text: `Nepodarilo sa spustiť platbu. (${data?.error ?? `HTTP ${res.status}`})` });
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
        setMsg({ type: "error", text: `Nepodarilo sa otvoriť Stripe portal. (${data?.error ?? `HTTP ${res.status}`})` });
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

    // odstráň buy z URL, aby sa to nespúšťalo opakovane po refresh
    const url = new URL(window.location.href);
    url.searchParams.delete("buy");
    window.history.replaceState({}, "", url.toString());

    startCheckout(buy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const buttonBase =
    "w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";

  const btnPrimary = "btn-primary " + buttonBase;

  const btnSecondary =
    buttonBase +
    " border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900";

  const isNoSub = subStatus === "none";
  const isBasic = subStatus === "basic";
  const isPlus = subStatus === "plus";

  // CTA podľa tvojich bodov 1–4:
  // - none: Zakúpiť BASIC/PLUS (checkout)
  // - basic: Basic = Spravovať (portal), Plus = Prejsť na PLUS (portal)
  // - plus: Plus = Spravovať (portal), Basic = Prejsť na BASIC (portal)
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
      {busy === "basic" ? "Presmerúvam…" : "Zakúpiť BASIC"}
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
      {busy === "plus" ? "Presmerúvam…" : "Zakúpiť PLUS"}
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
            price="10 €"
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

        {/* Spodnú sekciu “Pomoc” som odstránil. */}
      </div>
    </main>
  );
}