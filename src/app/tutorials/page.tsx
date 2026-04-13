//src/app/tutorials/page.tsx
"use client";

const INSTAGRAM_URL = "https://www.instagram.com/fudly.sk/";

type TutorialCardProps = {
  step: string;
  title: string;
  desc: string;
  src: string;
};

function TutorialCard({ step, title, desc, src }: TutorialCardProps) {
  return (
    <section className="rounded-3xl p-5 md:p-6 surface-same-as-nav surface-border">
      <div className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs font-semibold muted">
        {step}
      </div>

      <h2 className="mt-4 text-xl md:text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm md:text-base muted max-w-3xl">{desc}</p>

      <div className="mt-5 flex justify-center">
        <div className="w-full max-w-[420px] sm:max-w-[460px] md:max-w-[520px] overflow-hidden rounded-2xl surface-border bg-black">
          <video
            className="w-full h-auto block"
            controls
            playsInline
            preload="metadata"
          >
            <source src={src} type="video/mp4" />
            Tvoj prehliadač nepodporuje prehrávanie videa.
          </video>
        </div>
      </div>
    </section>
  );
}

export default function TutorialsPage() {
  return (
    <main className="min-h-screen page-invert-bg">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
        <header className="text-center">
          <div className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold surface-same-as-nav">
            Krátke videonávody k Fudly
          </div>

          <h1 className="mt-6 text-3xl md:text-5xl font-bold tracking-tight">
            Videonávody
          </h1>

          <p className="mt-4 max-w-2xl mx-auto text-sm md:text-base muted">
            Pozri si rýchly postup, ako funguje generovanie, práca s jedálničkom
            a finančný prehľad.
          </p>
        </header>

        <div className="mt-10 space-y-6">
          <TutorialCard
            step="Krok 1"
            title="Ako vygenerovať jedálniček"
            desc="Ukážka nastavenia preferencií a samotného vygenerovania plánu na týždeň."
            src="/tutorials/generovanie.mp4"
          />

          <TutorialCard
            step="Krok 2"
            title="Ako funguje jedálniček"
            desc="Prehľad vygenerovaného jedálnička, receptov, úprav a práce s plánom v profile."
            src="/tutorials/jedalnicek.mp4"
          />

          <TutorialCard
            step="Krok 3"
            title="Ako fungujú financie"
            desc="Vysvetlenie finančného prehľadu, odhadov cien a práce s rozpočtom."
            src="/tutorials/financie.mp4"
          />
        </div>

        <section className="mt-10 rounded-3xl p-6 md:p-8 surface-same-as-nav surface-border text-center">
          <div className="text-2xl font-semibold">Ďalšie tipy nájdeš na Instagrame</div>
          <p className="mt-3 text-sm md:text-base muted max-w-2xl mx-auto">
            Pozri si highlights, krátke ukážky a ďalší obsah k Fudly aj na našom Instagrame.
          </p>

          <div className="mt-6">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center justify-center rounded-2xl px-8 py-4 text-center font-semibold transition
                bg-gradient-to-r from-amber-600 to-amber-500
                hover:from-amber-500 hover:to-amber-400
                text-white
                shadow-lg shadow-amber-600/40
              "
            >
              Otvoriť Instagram
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}