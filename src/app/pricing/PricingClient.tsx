// src/app/pricing/PricingClient.tsx
"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/useT";

export default function PricingClient() {
  const { t } = useT();

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">{t.pricing.title}</h1>
            <p className="mt-2 text-gray-300">{t.pricing.subtitle}</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/generate"
              className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
            >
              {t.nav.generator}
            </Link>
            <Link
              href="/profile"
              className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
            >
              {t.nav.profile}
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* BASIC */}
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="text-lg font-semibold">{t.pricing.basic.title}</div>
            <div className="mt-1 text-sm text-gray-300">{t.pricing.basic.subtitle}</div>

            <ul className="mt-4 space-y-2 text-sm text-gray-200">
              {t.pricing.basic.features.map((x: string, i: number) => (
                <li key={i}>• {x}</li>
              ))}
            </ul>

            <div className="mt-6 text-xs text-gray-500">{t.pricing.basic.note}</div>
          </div>

          {/* PLUS */}
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="text-lg font-semibold">{t.pricing.plus.title}</div>
            <div className="mt-1 text-sm text-gray-300">{t.pricing.plus.subtitle}</div>

            <ul className="mt-4 space-y-2 text-sm text-gray-200">
              {t.pricing.plus.features.map((x: string, i: number) => (
                <li key={i}>• {x}</li>
              ))}
            </ul>

            <div className="mt-6 text-xs text-gray-500">{t.pricing.plus.note}</div>
          </div>
        </section>
      </div>
    </main>
  );
}