//src/app/page.tsx
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

function FeatureCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon?: string;
}) {
  return (
    <div className="rounded-2xl p-5 surface-same-as-nav surface-border transition hover:opacity-[0.98]">
      <div className="flex items-start gap-3">
        {icon ? <div className="text-2xl leading-none shrink-0 mt-0.5">{icon}</div> : null}
        <div>
          <div className="text-base font-semibold">{title}</div>
          <div className="mt-1 text-sm muted">{desc}</div>
        </div>
      </div>
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

function splitPrice(price: string) {
  const normalized = price.trim().replace(/\s+/g, "");
  const match = normalized.match(/^(\d+)([.,]\d{2})?(€)?$/);

  if (!match) {
    return {
      main: price,
      cents: "",
      currency: "",
    };
  }

  return {
    main: match[1] ?? "",
    cents: match[2] ?? "",
    currency: match[3] ?? "€",
  };
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
  const { main, cents, currency } = splitPrice(price);

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
          <div className="flex items-start justify-end gap-1">
            <span className="text-3xl font-bold leading-none">{main}</span>
            {cents ? (
              <span className="text-sm font-semibold leading-none relative top-[2px]">
                {cents}
              </span>
            ) : null}
            {currency ? (
              <span className="text-base font-semibold leading-none relative top-[2px]">
                {currency}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs muted-2">{period}</div>
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
          className="block w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold transition btn-primary"
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

function BenefitPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold surface-same-as-nav">
      {children}
    </div>
  );
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

    useEffect(() => {
    if (!supabase || !loggedIn) return;

    const refreshEntitlements = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setEnt(null);
        return;
      }

      const res = await fetch(`/api/entitlements?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json) {
        setEnt(json as Entitlements);
      } else {
        setEnt(null);
      }
    };

    const onFocus = () => {
      void refreshEntitlements();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshEntitlements();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, loggedIn]);
  const planLabel = ent?.active_like && ent?.plan ? ent.plan.toUpperCase() : "ŽIADNY";
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

  return (
    <main className="min-h-screen overflow-hidden page-invert-bg">
      <div className="mx-auto w-full max-w-6xl px-6">
        {loggedIn ? (
          <>
            <section className="pt-16 pb-12 relative isolate">
  <div className="pointer-events-none absolute inset-0 flex justify-center -z-20">
    <div className="w-[620px] h-[620px] bg-black/10 dark:bg-black/5 blur-[160px] rounded-full" />
  </div>

              <div className="absolute inset-x-0 top-0 flex justify-center pointer-events-none -z-10">
                <div className="relative w-[320px] h-[320px] md:w-[560px] md:h-[560px] opacity-[0.07] dark:opacity-[0.08]">
                  <Image
                    src="/logo_black.png"
                    alt=""
                    fill
                    className="object-contain dark:hidden"
                    priority
                  />
                  <Image
                    src="/logo_white.png"
                    alt=""
                    fill
                    className="object-contain hidden dark:block"
                    priority
                  />
                </div>
              </div>

              <div className="flex flex-col items-center text-center relative z-10">
                <h1 className="mt-4 font-bold tracking-tight leading-[1.04] px-3">
                  <span className="block text-[clamp(24px,5vw,50px)]">Vitaj späť, {firstName}</span>
                  <span className="block text-[clamp(20px,4.5vw,40px)] muted">pokračuj tam, kde si skončil/a</span>
                </h1>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <BenefitPill>Aktuálny plán: {planLabel}</BenefitPill>
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
          </>
        ) : (
          <section className="pt-20 pb-14 relative isolate">
  <div className="pointer-events-none absolute inset-0 flex justify-center -z-20">
    <div className="w-[760px] h-[760px] bg-black/10 dark:bg-black/5 blur-[180px] rounded-full" />
  </div>

            <div className="absolute inset-x-0 top-8 md:top-0 flex justify-center pointer-events-none -z-10">
              <div className="relative w-[360px] h-[360px] md:w-[640px] md:h-[640px] opacity-[0.07] dark:opacity-[0.08]">
                <Image
                  src="/logo_black.png"
                  alt=""
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/logo_white.png"
                  alt=""
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              </div>
            </div>

            <div className="flex flex-col items-center text-center relative z-10">
              <h1 className="mt-8 font-bold tracking-tight leading-[0.95] px-3 max-w-5xl">
                <span className="block text-[clamp(34px,7vw,78px)]">
                  Inteligentný týždenný plán
                </span>
                <span className="block mt-2 text-[clamp(28px,5.8vw,60px)] muted">
                  rýchlo a jednoducho
                </span>
              </h1>

              <p className="mt-6 max-w-3xl text-base sm:text-lg md:text-xl text-black/300 dark:text-gray-700">
                Týždenný jedálniček, nákupný zoznam, recepty, kalórie aj rozpočet na jednom mieste
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <BenefitPill>Hotový do 5 minút</BenefitPill>
                <BenefitPill>14 dní ZDARMA</BenefitPill>
                <BenefitPill>Zrušenie kedykoľvek</BenefitPill>
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
            </div>
          </section>
        )}

        <section className="pb-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              icon="🧠"
              title="Už viac nemusíš rozmýšlať, čo variť"
              desc="Fudly spraví všetko za teba a ty máš celý týždeň vyriešený dopredu."
            />
            <FeatureCard
              icon="🛒"
              title="Nakupuješ jednoduchšie a prehľadnejšie"
              desc="Všetky potrebné suroviny máš prehľadne spísané v nákupnom zozname."
            />
            <FeatureCard
              icon="💸"
              title="Máš lepší prehľad nad jedlom aj rozpočtom"
              desc="Vieš, čo budeš jesť, koľko to približne stojí a ako dodržiavaš svoj budget."
            />
          </div>
        </section>

        <section className="pb-14">
          <div className="rounded-3xl p-6 md:p-8 surface-same-as-nav surface-border">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-semibold">Prečo práve Fudly</div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <FeatureCard
                icon="⏱️"
                title="Šetrí čas"
                desc="Ušetrených niekoľko hodín týždenne vymýšľaním, plánovaním a nakupovaním jedla"
              />
              <FeatureCard
                icon="🥦"
                title="Znižuje odpad"
                desc="Zabudni na zbytočné plytvanie jedlom. Nakupuješ len to, čo naozaj potrebuješ"
              />
              <FeatureCard
                icon="📋"
                title="Zabezpečuje prehľad"
                desc="Jedálničky recepty, prehľad kalórií aj nákupné zoznamy spolu s financiami máš na jednom mieste"
              />
              <FeatureCard
                icon="✨"
                title="Prináša pokoj"
                desc="Menej stresu okolo jedla každý deň"
              />
            </div>
          </div>
        </section>

        <section className="pb-14">
          <div className="text-2xl font-semibold text-center">Čo všetko za teba Fudly vyrieši</div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <FeatureCard
              icon="📅"
              title="Týždenný jedálniček"
              desc="Raňajky, obed aj večera na celý týždeň v jednom prehľadnom pláne"
            />
            <FeatureCard
              icon="🛍️"
              title="Automatický nákupný zoznam"
              desc="Ingrediencie sa pripravia automaticky, takže nemusíš nič vypisovať ručne"
            />
            <FeatureCard
              icon="👨‍🍳"
              title="Recepty ku každému jedlu"
              desc="Stručné a praktické postupy, aby si mohol hneď variť"
            />
            <FeatureCard
              icon="🔥"
              title="Kalórie"
              desc="Denné aj týždenné kalórie pre lepší prehľad o stravovaní. (PLUS)"
            />
            <FeatureCard
              icon="📈"
              title="Finančný prehľad"
              desc="Sleduj budget, odhad a reálnu cenu na jednom mieste"
            />
            <FeatureCard
              icon="☁️"
              title="Všetko uložené v profile"
              desc="Jedálničky, recepty aj nákupné zoznamy sa ti nestratia a máš ich vždy poruke"
            />
          </div>
        </section>

        <section className="pb-16">
          <div className="rounded-3xl p-6 md:p-8 surface-same-as-nav surface-border">
            <div className="text-2xl font-semibold text-center">Pre koho je Fudly</div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <FeatureCard
                icon="💼"
                title="Pre zaneprázdnených"
                desc="Keď nechceš po práci ešte riešiť, čo budeš každý deň variť"
              />
              <FeatureCard
                icon="💶"
                title="Pre zodpovedných"
                desc="Keď potrebuješ mať v jedle poriadok a nakupovať efektívnejšie"
              />
              <FeatureCard
                icon="🎯"
                title="Pre náročných"
                desc="Kalórie, štýl stravy aj budget pod väčšou kontrolou"
              />
              <FeatureCard
                icon="🧘"
                title="Pre pohodových"
                desc="Maximum pohody. Bez stresu a námahy"
              />
            </div>
          </div>
        </section>

        <section className="pb-16">
          <div className="text-2xl font-semibold text-center">Vyber si štýl, ktorý ti sedí</div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <FeatureCard
              icon="💶"
              title="Lacné"
              desc="Keď chceš variť rozumne a úsporne"
            />
            <FeatureCard
              icon="⚡"
              title="Rýchle"
              desc="Keď máš minimum času v kuchyni"
            />
            <FeatureCard
              icon="🥗"
              title="Vyvážené"
              desc="Univerzálna voľba na bežné fungovanie"
            />
            <FeatureCard
              icon="🥕"
              title="Vegetariánske"
              desc="Bez mäsových výrobkov"
            />
            <FeatureCard
              icon="🌿"
              title="Vegánske (PLUS)"
              desc="Bez živočíšnych produktov"
            />
            <FeatureCard
              icon="🏋️"
              title="Fit (PLUS)"
              desc="Viac bielkovín a menej cukru"
            />
            <FeatureCard
              icon="🍲"
              title="Tradičné (PLUS)"
              desc="Klasické chute blízke domácej kuchyni"
            />
            <FeatureCard
              icon="🌍"
              title="Exotické (PLUS)"
              desc="Ázia, Mexiko a iné kuchyne sveta"
            />
          </div>

          <div className="mt-6 text-center text-sm muted">
            Každý týždeň môže vyzerať inak — podľa toho, na čo máš chuť!
          </div>
        </section>

        <section className="pb-16">
          <div className="rounded-3xl p-6 md:p-8 surface-same-as-nav surface-border">
            <div className="text-2xl font-semibold">Ako to funguje</div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Step n="1" title="Nastav základné parametre" desc="Počet osôb, budget, štýl jedál a iné preferencie" />
              <Step n="2" title="Vygeneruj plán" desc="Jedálniček + recepty + nákupné zoznamy " />
              <Step n="3" title="Ulož do profilu" desc="Všetko máš prehľadne dostupné v profile" />
            </div>
          </div>
        </section>

        {!loggedIn ? (
          <section className="pb-16">
            <div className="rounded-3xl p-6 md:p-10 surface-same-as-nav surface-border text-center">
              <div className="text-2xl md:text-3xl font-semibold">Začni s Fudly ešte dnes</div>
              <div className="mt-3 text-sm md:text-base muted max-w-2xl mx-auto">
                Otestuj si, aké je to mať jedlo, nákupy aj plánovanie konečne pod kontrolou
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/login"
                  className="
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
                  className="rounded-2xl px-8 py-4 text-center font-semibold transition border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900"
                >
                  Pozrieť členstvá
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {!loggedIn ? (
          <section className="pb-20">
            <div className="text-2xl font-semibold text-center">Vyber si členstvo</div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PricingCard
                title="Basic"
                subtitle="Pre rýchly štart"
                price="7,99 €"
                period="mesačne"
                ctaLabel="Začať zdarma (14 dní)"
                ctaHref="/login"
                features={[
                  "3 generovania týždenne",
                  "Jedálniček + nákupný zoznam",
                  "Recepty ku všetkým jedlám",
                  "Uloženie do profilu",
                  "Základný finančný prehľad",
                ]}
              />

              <PricingCard
                badge="Odporúčané"
                title="Plus"
                subtitle="Pre maximum pohodlia"
                price="11,99 €"
                period="mesačne"
                ctaLabel="Začať zdarma (14 dní)"
                ctaHref="/login"
                highlighted
                features={[
                  "Celý obsah BASIC + navyše:",
                  "2 generovania týždenne navyše (spolu 5)",
                  "Viac štýlov (Fit / Vegánske / Tradičné / Exotické)",
                  "Prehľad kalórií",
                  "Rozšírený finančný prehľad",
                ]}
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
