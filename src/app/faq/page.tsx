// src/app/faq/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type FaqItem = {
  q: string;
  a: string;
  tags?: string[];
};

const FAQ: FaqItem[] = [
  {
    q: "Čo je Fudly a komu to pomôže?",
    a: "Fudly je generátor týždenných jedálničkov. Vyplníš preferencie (ľudia, budget, alergie, čo máš doma) a dostaneš plán jedál + nákupy + recepty. Je to pre ľudí, ktorí nechcú riešiť „čo dnes variť“ a zároveň chcú mať poriadok v nákupoch.",
    tags: ["základ", "ako to funguje"],
  },
  {
    q: "Ako funguje generovanie jedálnička?",
    a: "Zadáš vstupy (týždeň, počet ľudí, budget, intolerancie, čo nechceš, čo máš doma, obľúbené suroviny, štýl). Potom klikneš na Generovať. Fudly vytvorí raňajky/obed/večeru na 7 dní, nákupný zoznam a recepty ku každému jedlu.",
    tags: ["generátor"],
  },
  {
    q: "Čo keď AI (OpenAI) dočasne vypadne alebo je preťažená?",
    a: "Zobrazí sa hláška, že generovanie sa nepodarilo a môžeš to skúsiť znova. Ideálne je ponúknuť aj „Retry“ tlačidlo. Správne nastavenie je, aby sa pri neúspechu neznížil zostávajúci počet generovaní.",
    tags: ["výpadok", "openai", "chyby"],
  },
  {
    q: "Odpočíta sa mi generovanie, ak to skončí chybou?",
    a: "Nie. Pri chybe (napr. dočasne nedostupná AI alebo nevalidný výstup) by sa generovanie nemalo odpočítať. Počet sa má znížiť iba vtedy, keď vznikne kompletný plán a úspešne sa uloží.",
    tags: ["limit", "generovania"],
  },
  {
    q: "Koľko generovaní mám k dispozícii?",
    a: "Závisí to od tvojho členstva. Basic a Plus majú rôzne týždenné limity (napr. 3 vs 5). Aktuálny stav vidíš priamo v Generátore.",
    tags: ["limit", "členstvo"],
  },
  {
    q: "V čom je rozdiel Basic vs Plus?",
    a: "Plus typicky obsahuje viac generovaní, viac štýlov a doplnkové metriky (napr. kalórie). Presné porovnanie nájdeš na stránke Členstvá.",
    tags: ["basic", "plus", "členstvo"],
  },
  {
    q: "Ako fungujú štýly (Lacné, Rýchle, Vyvážené…)?",
    a: "Štýl je preferencia, podľa ktorej Fudly skladá jedlá (napr. rýchle recepty s kratším časom prípravy, lacné s dôrazom na cenu, vyvážené s dôrazom na zeleninu a bielkoviny). Niektoré štýly môžu byť dostupné iba v Plus.",
    tags: ["štýly"],
  },
  {
    q: "Môžem jedlá alebo nákupy upravovať?",
    a: "Áno. V profile si vieš jedálniček aj nákupné položky upraviť. Upravované položky sa môžu označiť ako „upravené“, aby bolo jasné, čo si menil.",
    tags: ["profil", "úpravy"],
  },
  {
    q: "Ako sa ukladajú moje plány?",
    a: "Po vygenerovaní sa plán uloží do profilu (na daný týždeň). Vždy sa k nemu vieš vrátiť, pozrieť si recepty alebo exportovať nákupy.",
    tags: ["profil", "uloženie"],
  },
  {
    q: "Dá sa spraviť export nákupov?",
    a: "Áno. Na PC je praktický export na tlač. Na mobile sa dá spraviť export ako čistý text na zdieľanie (napr. do Poznámok).",
    tags: ["export", "nákupy"],
  },
  {
    q: "Dá sa nákupný zoznam zdieľať do Poznámok s odškrtávaním?",
    a: "Nie úplne univerzálne. Mobilné Poznámky (iOS/Android) nemajú jednotný formát pre „checklist“ cez web share. Najistejšie je zdieľať zoznam ako text s odrážkami, prípadne pridať prefix typu „[ ]“ a v Poznámkach si to prepneš na kontrolný zoznam.",
    tags: ["mobile", "poznámky", "checklist"],
  },
  {
    q: "Je možné zadať alergie a intolerancie?",
    a: "Áno. Intolerancie sú „hard zákaz“ (napr. arašidy, laktóza). Preferencie „avoid“ sú skôr mäkké (napr. huby).",
    tags: ["intolerancie", "alergie"],
  },
  {
    q: "Čo znamená „čo mám doma“?",
    a: "Do poľa „mám doma“ napíš suroviny, ktoré chceš spotrebovať (napr. ryža, vajcia). Fudly sa bude snažiť ich využiť v receptoch a znížiť plytvanie.",
    tags: ["mám doma"],
  },
  {
    q: "Je to vhodné aj pre rodiny?",
    a: "Áno. Nastavíš počet ľudí a budget. Porcie a nákupy sa prispôsobia tak, aby to sedelo pre viac osôb.",
    tags: ["rodina"],
  },
  {
    q: "Ako zruším členstvo?",
    a: "Členstvo sa zvyčajne spravuje cez Stripe (zákaznícky portál). Po zrušení dobehne aktuálne obdobie a ďalšie sa už nenaúčtuje.",
    tags: ["stripe", "zrušenie"],
  },
  {
    q: "Zľavové kódy – rieši sa to v Stripe alebo na stránke?",
    a: "Najčastejšie sa to rieši v Stripe (coupons/promotion codes) a stránka iba odkáže používateľa do checkoutu/portálu. Web zvyčajne len odovzdá správne ID ceny a Stripe uplatní zľavu.",
    tags: ["zľava", "stripe"],
  },
  {
    q: "Moje dáta – kde sa ukladajú a kto ich vidí?",
    a: "Plány sa ukladajú k tvojmu účtu (Supabase). Bežný používateľ vidí len svoje vlastné plány. Admin prístup je iba pre prevádzku a debugging.",
    tags: ["súkromie", "dáta"],
  },
  {
    q: "Môžem použiť Fudly bez prihlásenia?",
    a: "Generovanie je viazané na účet, aby sa dalo sledovať členstvo, limit generovaní a ukladať plány do profilu.",
    tags: ["login"],
  },
  {
    q: "Čo ak mi plán nevyhovuje?",
    a: "Môžeš skúsiť zmeniť štýl, upraviť preferencie (avoid/favorites/have) a vygenerovať znova. Prípadne si plán uprav manuálne v profile.",
    tags: ["úpravy", "plán"],
  },
];

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs font-semibold muted">
      {children}
    </span>
  );
}

function AccordionItem({
  item,
  open,
  onToggle,
}: {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl surface-same-as-nav surface-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
        aria-expanded={open}
      >
        <div>
          <div className="text-base font-semibold">{item.q}</div>
          {item.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((t, i) => (
                <Badge key={i}>{t}</Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 mt-1">
          <span
            className={[
              "inline-flex h-8 w-8 items-center justify-center rounded-full border transition",
              "border-gray-300 dark:border-gray-700",
              open ? "bg-gray-100 dark:bg-zinc-900" : "",
            ].join(" ")}
          >
            <span className="text-lg leading-none">{open ? "–" : "+"}</span>
          </span>
        </div>
      </button>

      {open ? (
        <div className="px-5 pb-5 -mt-1">
          <div className="text-sm muted whitespace-pre-wrap leading-relaxed">{item.a}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function FaqPage() {
  const [q, setQ] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    if (!nq) return FAQ;

    return FAQ.filter((x) => {
      const hay =
        normalize(x.q) +
        " " +
        normalize(x.a) +
        " " +
        normalize((x.tags ?? []).join(" "));
      return hay.includes(nq);
    });
  }, [q]);

  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">FAQ</h1>
              <div className="mt-2 text-sm muted">
                Rýchle odpovede na najčastejšie otázky o Fudly.
              </div>
            </div>

            <Link
              href="/"
              className="rounded-xl px-4 py-2 text-sm font-semibold transition border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900"
            >
              Späť domov
            </Link>
          </div>

          <div className="mt-5 rounded-2xl p-4 surface-same-as-nav surface-border">
            <label className="block">
              <div className="text-xs muted-2 mb-2">Hľadať</div>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpenIdx(null);
                }}
                className="input-surface"
                placeholder="napr. limit, zľava, export, OpenAI…"
              />
            </label>

            <div className="mt-3 text-xs muted-2">
              Tip: skús napr. „zľava“, „OpenAI“, „limit“, „Poznámky“.
            </div>
          </div>
        </header>

        <section className="space-y-4">
          {filtered.length ? (
            filtered.map((item, idx) => (
              <AccordionItem
                key={`${item.q}-${idx}`}
                item={item}
                open={openIdx === idx}
                onToggle={() => setOpenIdx((prev) => (prev === idx ? null : idx))}
              />
            ))
          ) : (
            <div className="rounded-2xl p-5 surface-same-as-nav surface-border">
              <div className="font-semibold">Nič som nenašiel</div>
              <div className="mt-1 text-sm muted">Skús iné slovo (napr. „limit“, „zľava“, „export“).</div>
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs muted-2">
          Nenašiel si odpoveď? Napíš nám cez <Link href="/contact" className="underline">Kontakt</Link>.
        </footer>
      </div>
    </main>
  );
}