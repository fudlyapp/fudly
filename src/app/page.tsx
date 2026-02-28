"use client";

import Image from "next/image";
import Link from "next/link";

type Feature = {
  title: string;
  desc: string;
};

const FEATURES: Feature[] = [
  { title: "Jedálničky", desc: "Raňajky • obed • večera na celý týždeň." },
  { title: "Nákupné zoznamy", desc: "Rozdelené podľa nákupov a kategórií." },
  { title: "Recepty", desc: "Stručné recepty pre všetkých 21 jedál." },
  { title: "Sledovanie kalórií", desc: "Kcal na jedlo aj súčet za deň/týždeň." },
  { title: "Finančný prehľad", desc: "Budget vs odhad vs reálna cena nákupov." },
];

function FeatureCard({ title, desc }: Feature) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black p-5 hover:bg-zinc-950 transition">
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-1 text-sm text-gray-400">{desc}</div>
    </div>
  );
}

function StepCard({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black p-6">
      <div className="text-xs text-gray-500">Krok {n}</div>
      <div className="mt-2 text-lg font-semibold">{title}</div>
      <div className="mt-2 text-sm text-gray-400">{desc}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        {/* HERO */}
        <section className="flex flex-col items-center text-center">
          <div className="w-full flex flex-col items-center justify-center">
            <div className="relative h-48 w-48 md:h-56 md:w-56">
              {/* Použi biele logo na tmavom pozadí */}
              <Image
                src="/logo_white.png"
                alt="Fudly"
                fill
                priority
                className="object-contain"
              />
            </div>

            <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight">Fudly</h1>
            <p className="mt-4 max-w-2xl text-gray-300 text-base md:text-lg">
              Týždenný plán hotový na jedno kliknutie – typicky do <span className="text-white font-semibold">2–3 minút</span>.
              Jedlá, recepty, nákupy, kalórie aj prehľad výdavkov – všetko v profile.
            </p>

            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-black font-semibold hover:bg-gray-200 transition text-base"
              >
                Vyskúšaj na 14 dní zadarmo
              </Link>
              <div className="mt-2 text-xs text-gray-500">
                Registrácia trvá pár sekúnd.
              </div>
            </div>
          </div>
        </section>

        {/* FEATURE BANNERS */}
        <section className="mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>

        {/* 3 KROKY */}
        <section className="mt-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Ako to funguje</h2>
              <p className="mt-2 text-sm text-gray-400">
                Jednoduchý flow: nastavíš preferencie → vygeneruješ týždeň → všetko máš uložené.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <StepCard
              n="1"
              title="Nastav preferencie"
              desc="Počet ľudí, budget, intolerancie, obľúbené a štýl jedál."
            />
            <StepCard
              n="2"
              title="Vygeneruj týždenný plán"
              desc="Raňajky, obedy, večere + recepty, kalórie a nákupné zoznamy."
            />
            <StepCard
              n="3"
              title="Všetko bezpečne uložené v profile"
              desc="Vieš upravovať, dopĺňať reálne ceny nákupov a sledovať prehľady."
            />
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 border-t border-gray-900 pt-8 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Fudly
        </footer>
      </div>
    </main>
  );
}