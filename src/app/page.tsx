// src/app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl p-5 surface-same-as-nav surface-border transition hover:opacity-[0.98]">
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm muted">{desc}</div>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl p-5 surface-same-as-nav surface-border">
      <div className="text-xs muted-2">Krok {n}</div>
      <div className="mt-2 text-lg font-semibold">{title}</div>
      <div className="mt-1 text-sm muted">{desc}</div>
    </div>
  );
}

function PricingCard({
  badge,
  title,
  subtitle,
  price,
  period,
  ctaLabel,
  ctaHref,
  features,
  highlighted,
}: {
  badge?: string;
  title: string;
  subtitle: string;
  price: string;
  period: string;
  ctaLabel: string;
  ctaHref: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-3xl border p-6 surface-same-as-nav surface-border",
        highlighted ? "ring-1 ring-black/10 dark:ring-white/10" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {badge && (
            <div className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs muted">
              {badge}
            </div>
          )}
          <div className="mt-3 text-xl font-semibold">{title}</div>
          <div className="mt-1 text-sm muted">{subtitle}</div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold">{price}</div>
          <div className="text-xs muted-2">{period}</div>
        </div>
      </div>

      <ul className="mt-5 space-y-2 text-sm muted">
        {features.map((f, i) => (
          <li key={i} className="flex gap-2">
            <span>•</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Link
          href={ctaHref}
          className={[
            "block w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold transition",
            highlighted
              ? "btn-primary"
              : "border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900",
          ].join(" ")}
        >
          {ctaLabel}
        </Link>
        <div className="mt-2 text-xs muted-2 text-center">14 dní zdarma • Zrušíš kedykoľvek</div>
      </div>
    </div>
  );
}

function AppActionCard({
  title,
  desc,
  href,
  primary,
}: {
  title: string;
  desc: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-2xl p-5 surface-same-as-nav surface-border transition block",
        primary ? "ring-1 ring-black/10 dark:ring-white/10" : "",
        "hover:opacity-[0.98]",
      ].join(" ")}
    >
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm muted">{desc}</div>
      <div className="mt-4">
        <span
          className={[
            "inline-flex rounded-xl px-4 py-2 text-sm font-semibold transition",
            primary
              ? "btn-primary"
              : "border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900",
          ].join(" ")}
        >
          Otvoriť
        </span>
      </div>
    </Link>
  );
}

function statusLabel(status: string) {
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
    default:
      return "none";
  }
}

export default function HomePage() {
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);

  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const sessionUser = data.session?.user ?? null;
        setLoggedIn(!!sessionUser);
        setUserEmail(sessionUser?.email ?? null);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const sessionUser = session?.user ?? null;
      setLoggedIn(!!sessionUser);
      setUserEmail(sessionUser?.email ?? null);
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !loggedIn) {
      setEnt(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        if (!cancelled) setEnt(null);
        return;
      }

      const res = await fetch(`/api/entitlements?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!cancelled) {
        if (res.ok && json) {
          setEnt(json as Entitlements);
        } else {
          setEnt(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, loggedIn]);

  const planLabel = ent?.plan ? ent.plan.toUpperCase() : "ŽIADNY";
  const remaining = ent?.remaining ?? null;
  const weeklyLimit = ent?.weekly_limit ?? null;
  const firstName =
    userEmail?.split("@")[0]?.split(".")[0]?.replace(/^./, (s) => s.toUpperCase()) || "vitaj späť";

  if (checkingAuth) {
    return (
      <main className="min-h-screen page-invert-bg">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="rounded-3xl p-6 surface-same-as-nav surface-border text-sm muted">
            Načítavam…
          </div>
        </div>
      </main>
    );
  }

  if (loggedIn) {
    return (
      <main className="min-h-screen overflow-hidden page-invert-bg">
        <div className="mx-auto w-full max-w-6xl px-6">
          <section className="pt-16 pb-12 relative">
            <div className="absolute inset-0 flex justify-center -z-10">
              <div className="w-[620px] h-[620px] bg-black/10 dark:bg-black/5 blur-[160px] rounded-full" />
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative w-44 h-44 md:w-56 md:h-56">
                <Image src="/logo_black.png" alt="Fudly logo" fill className="object-contain dark:hidden" priority />
                <Image src="/logo_white.png" alt="Fudly logo" fill className="object-contain hidden dark:block" priority />
              </div>

              <h1 className="mt-4 font-bold tracking-tight leading-[1.04] px-3">
                <span className="block text-[clamp(24px,5vw,50px)]">Vitaj späť, {firstName}</span>
                <span className="block text-[clamp(20px,4.5vw,40px)] muted">pokračuj tam, kde si skončil/a</span>
              </h1>

              <p className="mt-5 max-w-2xl text-base sm:text-lg text-black/70 dark:text-black/70">
                Generátor, profil aj členstvo máš pripravené. Stačí si vybrať, čo chceš práve otvoriť.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <div className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold surface-same-as-nav">
                  Aktuálny plán: {planLabel}
                </div>

                {ent?.status ? (
                  <div className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold surface-same-as-nav">
                    Stav: {statusLabel(ent.status)}
                  </div>
                ) : null}

              </div>
            </div>
          </section>

          <section className="pb-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AppActionCard
                title="Vygenerovať jedálniček"
                desc="Spusť nový týždenný plán podľa svojich preferencií."
                href="/generate"
                primary
              />
              <AppActionCard
                title="Otvoriť profil"
                desc="Pozri si uložené plány, recepty a nákupné zoznamy."
                href="/profile"
              />
              <AppActionCard
                title="Spravovať členstvo"
                desc="Skontroluj plán, limity a prípadne prejdi na vyššie členstvo."
                href="/pricing"
              />
            </div>
          </section>

          <section className="pb-14">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FeatureCard
                title="Aktívny generátor"
                desc={
                  ent?.can_generate
                    ? "Môžeš pokračovať v generovaní ďalších jedálničkov."
                    : "Členstvo momentálne neumožňuje generovanie."
                }
              />
              <FeatureCard
                title="Štýly jedál"
                desc={
                  ent?.allowed_styles?.length
                    ? `Dostupné: ${ent.allowed_styles.join(", ")}.`
                    : "Štýly sa načítajú po overení členstva."
                }
              />
              <FeatureCard
                title="Kalórie a financie"
                desc={
                  ent?.calories_enabled
                    ? "Kalórie aj finančný prehľad máš dostupné."
                    : "Kalórie sú dostupné v členstve PLUS."
                }
              />
            </div>
          </section>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden page-invert-bg">
      <div className="mx-auto w-full max-w-6xl px-6">
        {/* HERO */}
        <section className="pt-20 pb-16 relative">
          <div className="absolute inset-0 flex justify-center -z-10">
            <div className="w-[620px] h-[620px] bg-black/10 dark:bg-black/5 blur-[160px] rounded-full" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative w-60 h-60 md:w-80 md:h-80">
              <Image src="/logo_black.png" alt="Fudly logo" fill className="object-contain dark:hidden" priority />
              <Image src="/logo_white.png" alt="Fudly logo" fill className="object-contain hidden dark:block" priority />
            </div>

            <h1 className="mt-6 font-bold tracking-tight leading-[1.02] px-3">
              <span className="block whitespace-nowrap text-[clamp(22px,6vw,56px)]">
                Inteligentný týždenný jedálniček
              </span>
              <span className="block text-[clamp(20px,5.2vw,48px)] muted">na jedno kliknutie</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base sm:text-lg text-black/70 dark:text-black/70">
              Do 5 minút máš hotový plán na celý týždeň. Jedlá, nákupy, recepty, kalórie aj finančný prehľad.
            </p>

            <div className="mt-8 inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold surface-same-as-nav">
              14 dní zdarma • bez záväzkov
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link
                href="/login"
                className="
                  w-full sm:w-auto
                  rounded-2xl px-8 py-4 text-center font-semibold transition
                  bg-gradient-to-r from-amber-600 to-amber-500
                  hover:from-amber-500 hover:to-amber-400
                  text-white
                  shadow-lg shadow-amber-600/40
                "
              >
                Vyskúšaj na 14 dní zadarmo
              </Link>

              <Link
                href="/pricing"
                className={[
                  "w-full sm:w-auto rounded-2xl px-8 py-4 text-center font-semibold transition",
                  "bg-white text-black border border-gray-300 hover:bg-gray-50",
                  "dark:bg-black dark:text-white dark:border-gray-700 dark:hover:bg-zinc-900",
                ].join(" ")}
              >
                Pozrieť členstvá
              </Link>
            </div>

            <div className="mt-3 text-sm text-black/60 dark:text-black/60">
              Registrácia trvá pár sekúnd • Zrušíš kedykoľvek
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="pb-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard title="Jedálničky" desc="Raňajky, obed, večera na celý týždeň optimalizované na čas aj rozpočet." />
            <FeatureCard title="Nákupné zoznamy" desc="Pripravené nákupy rozdelené počas týždňa." />
            <FeatureCard title="Recepty" desc="Stručné postupy ku každému jedlu." />
            <FeatureCard title="Kalórie" desc="Denné aj týždenné kalórie (PLUS)." />
            <FeatureCard title="Financie" desc="Budget vs odhad vs reálna cena." />
            <FeatureCard title="Profil" desc="Všetko uložené a vždy dostupné." />
          </div>
        </section>

        {/* AKO TO FUNGUJE */}
        <section className="pb-16">
          <div className="rounded-3xl p-6 md:p-8 surface-same-as-nav surface-border">
            <div className="text-2xl font-semibold">Ako to funguje</div>
            <div className="mt-1 text-sm muted">Jednoduché. Rýchle. Bez chaosu.</div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Step n="1" title="Nastav preferencie" desc="Počet ľudí, budget, intolerancie a štýl jedál." />
              <Step n="2" title="Vygeneruj plán" desc="Jedálniček + nákupy + recepty." />
              <Step n="3" title="Ulož do profilu" desc="Všetko máš prehľadne uložené." />
            </div>
          </div>
        </section>

        {/* ČLENSTVÁ NA KONCI */}
        <section className="pb-20">
          <div className="text-2xl font-semibold text-center">Vyber si členstvo</div>
          <div className="mt-2 text-sm muted text-center">Začni zdarma na 14 dní. Potom si vyber, čo ti sedí.</div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PricingCard
              title="Basic"
              subtitle="Pre rýchly štart"
              price="9 €"
              period="mesačne"
              ctaLabel="Začať zdarma (14 dní)"
              ctaHref="/login"
              features={[
                "3 generovania týždenne",
                "Jedálniček + nákupný zoznam",
                "Recepty ku všetkým jedlám",
                "Uloženie do profilu",
              ]}
            />

            <PricingCard
              badge="Odporúčané"
              title="Plus"
              subtitle="Pre maximum pohodlia"
              price="13 €"
              period="mesačne"
              ctaLabel="Začať zdarma (14 dní)"
              ctaHref="/login"
              highlighted
              features={[
                "5 generovaní týždenne",
                "Viac štýlov",
                "Kalórie na osobu",
                "Finančný prehľad",
              ]}
            />
          </div>
        </section>
      </div>
    </main>
  );
}