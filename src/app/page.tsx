// src/app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

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

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden page-invert-bg">
      <div className="mx-auto w-full max-w-6xl px-6">
        {/* HERO */}
        <section className="pt-20 pb-16 relative">
          <div className="absolute inset-0 flex justify-center -z-10">
            <div className="w-[620px] h-[620px] bg-black/10 dark:bg-black/5 blur-[160px] rounded-full" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative w-56 h-56 md:w-80 md:h-80">
              <Image src="/logo_black.png" alt="Fudly logo" fill className="object-contain dark:hidden" priority />
              <Image src="/logo_white.png" alt="Fudly logo" fill className="object-contain hidden dark:block" priority />
            </div>

            <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight whitespace-nowrap">
              Inteligentný týždenný jedálniček{" "}
              <span className="block muted">na jedno kliknutie</span>
            </h1>

            <p className="mt-6 max-w-2xl muted text-lg">
              Do 2–3 minút máš hotový plán na celý týždeň. Jedlá, nákupy, recepty, kalórie aj finančný prehľad.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link href="/login" className="rounded-2xl btn-primary px-8 py-4 shadow-sm">
                Vyskúšaj na 14 dní zadarmo
              </Link>
              <Link
                href="/pricing"
                className="rounded-2xl border border-gray-300 dark:border-gray-700 px-8 py-4 font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition"
              >
                Pozrieť členstvá
              </Link>
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
              price="7 € + DPH"
              period="mesačne"
              ctaLabel="Začať zdarma (14 dní)"
              ctaHref="/login"
              features={["3 generovania týždenne", "Jedálniček + nákupný zoznam", "Recepty ku všetkým jedlám", "Uloženie do profilu"]}
            />

            <PricingCard
              badge="Odporúčané"
              title="Plus"
              subtitle="Pre maximum pohodlia"
              price="10 € + DPH"
              period="mesačne"
              ctaLabel="Začať zdarma (14 dní)"
              ctaHref="/login"
              highlighted
              features={["5 generovaní týždenne", "Viac štýlov", "Kalórie na osobu", "Finančný prehľad"]}
            />
          </div>
        </section>
      </div>
    </main>
  );
}