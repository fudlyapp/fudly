//src/app/faq/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type FaqItem = {
  q: string;
  a: string;
};

const FAQ: FaqItem[] = [
  {
    q: "Čo je Fudly a pre koho je určené?",
    a: "Fudly je generátor týždenných jedálničkov. Vyplníš preferencie (počet ľudí, budget, alergie, suroviny,ktoré chceš použiť) a dostaneš týždenný jedálníček + nákupný zoznam + recepty ku všetkým jedlám. Je to pre ľudí, ktorí nechcú riešiť „čo dnes variť“ a zároveň chcú mať poriadok v nakupovaní a financiách.",
  },
  {
    q: "Ako funguje generovanie jedálnička?",
    a: "Vygenerovať plán si vieš vždy na budúci týždeň. Stačí vyplniť preferencie a kliknúť na Generovať. Fudly do pár minúť vytvorí kompletný jedálniček (raňajky/obed/večera) na 7 dní, nákupné zoznamy a recepty ku každému jedlu. Zároveň sa plán uloží do tvojho profilu, kde si ho môžeš pozrieť, prípadne upraviť. V profile nájdeš finančný prehľad, kalorický prehľad (PLUS), ako aj históriu všetkých vygenerovaných plánov.",
  },
  {
    q: "Koľko generovaní mám k dispozícii?",
    a: "Závisí to od tvojho členstva. Basic a Plus majú rôzne týždenné limity (3 vs 5). Aktuálny zostatok generovaní na daný týždeň vidíš priamo v Generátore.",
  },
  {
    q: "V čom je rozdiel Basic vs Plus?",
    a: "Plus obsahuje viac generovaní, viac štýlov a doplnkové metriky (napr. kalórie a detailnejší finančný prehľad). Presné porovnanie nájdeš na stránke Členstvá.",
  },
  {
    q: "Ako fungujú štýly (Lacné, Rýchle, Vyvážené…)?",
    a: "Štýl je preferencia, podľa ktorej Fudly skladá jedlá (napr. rýchle recepty s kratším časom prípravy, lacné s dôrazom na cenu, vyvážené s dôrazom na zeleninu a bielkoviny). Niektoré štýly môžu byť dostupné iba v Plus.",
  },
  {
    q: "Viem si uložiť svoje preferencie, aby som ich nemusel vypĺňať pri každom generovaní?",
    a: "Áno. Svoje preferencie si vieš v Generátore uložiť ako predvolené. Pri ďalšom generovaní si ich vieš jedným klikom načítať. Zároveň si ich vieš upraviť a opätovne uložiť. Predvolené preferencie nájdeš aj v profile, kde si ich vieš tiež kedykoľvek upraviť.",
  },
  {
    q: "Ako sa ukladajú moje plány?",
    a: "Po vygenerovaní sa plán automaticky uloží do profilu (na daný týždeň). Vždy sa k nemu vieš vrátiť, pozrieť si recepty alebo exportovať nákupný zoznam. Na každý týždeň môžeš mať uložený iba 1 plán. V prípade, že si chceš vygenerovať nový, Fudly sa ťa opýta, či ním chceš nahradiť aktuálne uložený plán.",
  },
  {
    q: "Môžem uložený jedálniček upraviť?",
    a: "Áno. V profile si vieš jedálniček upraviť. Pri upravených jedlách recept nebude k dispozícii. Pri takto upravenom jedle si vieš sám zmeniť kalórie, aby ostal tvoj kalorický prehľad čo najpresnejší",
  },
  {
    q: "Môžem si upraviť nákupný zoznam?",
    a: "Áno. V profile si vieš nákupný zoznam upraviť (napr. pridať/odstrániť položku, zmeniť množstvo aj odhadovanú cenu). Upravené položky sa automaticky prepočítajú do odhadu ceny nákupu.",
  },
  {
    q: "Dá sa spraviť export nákupných zoznamov?",
    a: "Áno. Na PC je praktický export na tlač. Na mobile sa dá spraviť export (napr. do Poznámok).",
  },
  {
    q: "Je možné zadať alergie a intolerancie?",
    a: "Áno. Intolerancie sú „tvrdý zákaz“ (napr. arašidy, laktóza).",
  },
  {
    q: "Ako funguje „Obľúbené“ v Generátore?",
    a: "V časti Obľúbené si môžeš vypísať suroviny, prípadne aj konkretné jedlá, ktoré chceš mať v jedálničku na daný týždeň.",
  },
   {
    q: "Ako funguje „Špecifikácie“ v Generátore?",
    a: "Možnosť zadať konkrétnu požiadavku (napr. „rezeň so zemiakmi v nedeľu na obed :) ",
  },
  {
    q: "Je to vhodné aj pre viac ľudí?",
    a: "Áno. V generátore si vieš jednoducho zvoliť počet osôb. Porcie a nákupné zoznamy sa prispôsobia počtu osôb.",
  },
  {
    q: "Ako zruším členstvo?",
    a: "Členstvo si môžeš zrušiť cez Spravovať predplatné. Po zrušení dobehne aktuálne obdobie a ďalšie sa už nenaúčtuje.",
  },
  {
    q: "Môžem použiť Fudly bez prihlásenia?",
    a: "Generovanie je viazané na účet, aby sa dala sledovať celá história plánov a finačných prehľadov.",
  },
  {
    q: "Čo ak mi plán nevyhovuje?",
    a: "Môžeš skúsiť zmeniť štýl, upraviť preferencie (avoid/favorites/have) a vygenerovať znova. Prípadne si plán uprav manuálne v profile.",
  },
];

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
        <div className="text-base font-semibold">{item.q}</div>

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
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">FAQ</h1>
              
            </div>

            <Link
              href="/"
              className="rounded-xl px-4 py-2 text-sm font-semibold transition border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900"
            >
              Späť domov
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          {FAQ.map((item, idx) => (
            <AccordionItem
              key={`${item.q}-${idx}`}
              item={item}
              open={openIdx === idx}
              onToggle={() => setOpenIdx((prev) => (prev === idx ? null : idx))}
            />
          ))}
        </section>

        <footer className="mt-8 text-center text-xs muted-2">
          Nenašiel si odpoveď? Napíš nám cez <Link href="/contact" className="underline">Kontakt</Link>.
        </footer>
      </div>
    </main>
  );
}