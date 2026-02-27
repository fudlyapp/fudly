// src/app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function HomePage() {
  const { t } = useT();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  return (
    <main className="min-h-[calc(100vh-73px)] text-white">
      <div className="relative overflow-hidden">
        {/* base background */}
        <div className="pointer-events-none absolute inset-0 bg-black" />

        {/* full-page watermark */}
        <div className="fudly-watermark" />

        {/* subtle gradients on top of watermark (nech to vyzera premium) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_10%,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_80%_30%,rgba(255,255,255,0.06),transparent_60%)]" />

        <div className="relative mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          {/* HERO */}
          <section className="rounded-[32px] border border-gray-800 bg-zinc-950/55 p-8 shadow-2xl backdrop-blur md:p-12">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
              {/* left */}
              <div>
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-gray-800 bg-black/40 px-3 py-1 text-xs text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                  <span>14 dní zadarmo</span>
                  <span className="text-gray-600">•</span>
                  {email ? (
                    <span>
                      {t.profile.loggedAs}: <span className="text-white">{email}</span>
                    </span>
                  ) : (
                    <span>{t.home.tagline}</span>
                  )}
                </div>

                <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-6xl">
                  {t.home.title}
                </h1>

                <p className="mt-4 text-lg text-gray-200 md:text-2xl">
                  {t.home.subtitle}
                </p>

                <p className="mt-3 text-sm text-gray-500">
                  {t.home.tagline}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={email ? "/generate" : "/login?mode=signup"}
                    className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-gray-200"
                  >
                    {email ? t.nav.generator : "Vyskúšať zadarmo (14 dní)"}
                  </Link>

                  <Link
                    href="/pricing"
                    className="rounded-xl border border-gray-700 bg-black px-6 py-3 text-sm font-semibold hover:bg-zinc-900"
                  >
                    {t.nav.pricing}
                  </Link>

                  {email ? (
                    <Link
                      href="/profile"
                      className="rounded-xl border border-gray-700 bg-black px-6 py-3 text-sm font-semibold hover:bg-zinc-900"
                    >
                      {t.nav.profile}
                    </Link>
                  ) : null}
                </div>

                <div className="mt-8 flex flex-wrap gap-2 text-xs text-gray-400">
                  <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1">✅ Jedálniček</span>
                  <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1">🛒 Nákupy</span>
                  <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1">🔥 Kalórie</span>
                  <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1">✨ 14 dní zdarma</span>
                </div>
              </div>

              {/* right card */}
              <div className="relative">
                <div className="absolute -inset-6 rounded-[36px] bg-[radial-gradient(300px_200px_at_30%_30%,rgba(255,255,255,0.08),transparent_60%)] blur-2xl" />
                <div className="relative rounded-[28px] border border-gray-800 bg-black/50 p-6 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl border border-gray-800 bg-black p-3">
                      <Image src="/fudly_white.png" alt="Fudly" width={56} height={56} unoptimized />
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Fudly</div>
                      <div className="text-lg font-semibold text-white">
                        14 dní zadarmo • 2 kompletné týždenné jedálničky a nákupné zoznamy
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3">
                    <MiniCard title={t.home.f1Title} desc={t.home.f1Desc} icon="🍽️" />
                    <MiniCard title={t.home.f2Title} desc={t.home.f2Desc} icon="🛒" />
                    <MiniCard title={t.home.f3Title} desc={t.home.f3Desc} icon="✨" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StepCard n="01" title="Nastav preferencie" desc="Počet ľudí, budget, štýl, intolerancie a čo máš doma." />
            <StepCard n="02" title="Vygeneruj týždeň" desc="Raňajky, obed, večera + recepty a nákupy." />
            <StepCard n="03" title="Bez starostí" desc="Uložené v profile, prehľadné a pripravené na ďalší týždeň." />
          </section>

          {/* CTA bottom */}
          <section className="mt-10 rounded-[28px] border border-gray-800 bg-zinc-950/55 p-6 shadow-xl backdrop-blur md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xl font-semibold">Vyskúšaj Fudly na 14 dní zadarmo</div>
                <div className="mt-1 text-sm text-gray-400">
                  Bez záväzkov. Zrušíš kedykoľvek.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={email ? "/generate" : "/login?mode=signup"}
                  className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-gray-200"
                >
                  {email ? t.nav.generator : "Vytvoriť účet"}
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-xl border border-gray-700 bg-black px-6 py-3 text-sm font-semibold hover:bg-zinc-900"
                >
                  {t.nav.pricing}
                </Link>
              </div>
            </div>
          </section>

          <div className="mt-10 pb-10 text-center text-xs text-gray-600">
            © {new Date().getFullYear()} Fudly
          </div>
        </div>
      </div>
    </main>
  );
}

function MiniCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-lg">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-gray-400">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-gray-800 bg-black/35 p-6 shadow-lg">
      <div className="text-xs text-gray-500">{n}</div>
      <div className="mt-2 text-lg font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm text-gray-400">{desc}</div>
    </div>
  );
}