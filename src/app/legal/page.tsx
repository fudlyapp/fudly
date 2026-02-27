// src/app/legal/page.tsx
"use client";

import { useT } from "@/lib/i18n/useT";

export default function LegalPage() {
  const { t } = useT();
  const updated = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6">
          <div className="text-sm text-gray-400">Fudly</div>
          <h1 className="mt-2 text-3xl font-bold">{t.legal.title}</h1>
          <div className="mt-2 text-sm text-gray-400">
            {t.legal.updated} <span className="text-white font-semibold">{updated}</span>
          </div>
        </div>

        <div className="space-y-4">
          <Section title={t.legal.sections.termsTitle}>
            <p className="text-sm text-gray-200">{t.legal.terms.intro}</p>

            <Bullets title="Služba" items={t.legal.terms.service} />
            <Bullets title="Účet" items={t.legal.terms.account} />
            <Bullets title="Ceny a členstvá" items={t.legal.terms.pricing} />
            <Bullets title="Zodpovednosť" items={t.legal.terms.liability} />
          </Section>

          <Section title={t.legal.sections.privacyTitle}>
            <p className="text-sm text-gray-200">{t.legal.privacy.intro}</p>

            <Bullets title="Aké údaje" items={t.legal.privacy.data} />
            <Bullets title="Na čo" items={t.legal.privacy.purpose} />
            <Bullets title="Uchovávanie" items={t.legal.privacy.retention} />
            <Bullets title="Tvoje práva" items={t.legal.privacy.rights} />

            <div className="mt-3 text-sm text-gray-300">{t.legal.privacy.contact}</div>
          </Section>

          <Section title={t.legal.sections.refundTitle}>
            <p className="text-sm text-gray-200">{t.legal.refund.intro}</p>

            <Bullets title="Zrušenie" items={t.legal.refund.cancel} />
            <Bullets title="Refundácie" items={t.legal.refund.refunds} />
            <Bullets title="Trial" items={t.legal.refund.trial} />
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <div className="text-sm font-semibold text-gray-100">{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-gray-200">
        {items.map((x, i) => (
          <li key={i}>• {x}</li>
        ))}
      </ul>
    </div>
  );
}