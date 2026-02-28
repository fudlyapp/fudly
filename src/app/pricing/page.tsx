// src/app/pricing/page.tsx
"use client";

import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8">
          <h1 className="mt-2 text-3xl font-bold">Členstvá</h1>
          <p className="mt-2 muted">Vyber si plán, ktorý ti sedí. Zmeniť ho môžeš kedykoľvek.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl p-6 surface-same-as-nav surface-border">
            <div className="text-sm muted-2">Basic</div>
            <div className="mt-2 text-3xl font-bold">7 € + DPH</div>
            <div className="mt-1 text-sm muted-2">mesačne</div>

            <ul className="mt-4 space-y-2 text-sm muted">
              <li>• Generovanie jedálničkov</li>
              <li>• Nákupné zoznamy</li>
              <li>• Recepty ku všetkým jedlám</li>
              <li>• Uloženie do profilu</li>
              <li className="muted-2">• Kalórie (iba PLUS)</li>
              <li className="muted-2">• Finančný prehľad (iba PLUS)</li>
            </ul>

            <Link href="/login" className="mt-6 inline-flex w-full items-center justify-center btn-primary">
              Začať s Basic
            </Link>

            <div className="mt-2 text-xs muted-2 text-center">14 dní zdarma • Zrušíš kedykoľvek</div>
          </div>

          <div className="rounded-3xl p-6 surface-same-as-nav surface-border">
            <div className="text-sm muted-2">Plus</div>
            <div className="mt-2 text-3xl font-bold">10 € + DPH</div>
            <div className="mt-1 text-sm muted-2">mesačne</div>

            <ul className="mt-4 space-y-2 text-sm muted">
              <li>• Všetko z Basic</li>
              <li>• Kalórie (zobrazenie + prehľad)</li>
              <li>• Finančný prehľad</li>
              <li>• Viac štýlov jedálničkov</li>
              <li>• Viac generovaní / týždeň</li>
            </ul>

            <Link href="/login" className="mt-6 inline-flex w-full items-center justify-center btn-primary">
              Prejsť na Plus
            </Link>

            <div className="mt-2 text-xs muted-2 text-center">14 dní zdarma • Zrušíš kedykoľvek</div>
          </div>
        </section>
      </div>
    </main>
  );
}