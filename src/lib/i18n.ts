// src/lib/i18n.ts
export type Lang = "sk" | "en" | "uk";

export function normalizeLang(raw: any): Lang {
  const v = String(raw || "").toLowerCase().trim();
  if (v === "en") return "en";
  if (v === "uk" || v === "ua" || v === "ukr") return "uk";
  return "sk";
}

type Dict = Record<string, Record<Lang, string>>;

export const dict: Dict = {
  appName: { sk: "Fudly", en: "Fudly", uk: "Fudly" },

  generatorTitle: {
    sk: "Generátor týždenného plánu",
    en: "Weekly plan generator",
    uk: "Генератор тижневого плану",
  },

  week: { sk: "Týždeň (pondelok–nedeľa)", en: "Week (Mon–Sun)", uk: "Тиждень (пн–нд)" },
  people: { sk: "Počet ľudí (1–6)", en: "People (1–6)", uk: "Кількість людей (1–6)" },
  budget: { sk: "Budget / týždeň (€) (1–1000)", en: "Budget / week (€) (1–1000)", uk: "Бюджет / тиждень (€) (1–1000)" },

  style: { sk: "Preferovaný štýl", en: "Preferred style", uk: "Бажаний стиль" },
  trips: { sk: "Nákupy / týždeň", en: "Shopping trips / week", uk: "Покупки / тиждень" },
  repeat: { sk: "Varenie na viac dní", en: "Cook for multiple days", uk: "Готувати на кілька днів" },

  intolerances: { sk: "❌ Intolerancie / NESMÚ byť použité", en: "❌ Intolerances / FORBIDDEN", uk: "❌ Непереносимість / ЗАБОРОНЕНО" },
  avoid: { sk: "Vyhnúť sa", en: "Avoid", uk: "Уникати" },
  have: { sk: "Mám doma (použi)", en: "I have at home (use)", uk: "Є вдома (використай)" },
  favorites: { sk: "Obľúbené", en: "Favorites", uk: "Улюблене" },

  generate: { sk: "Vygenerovať", en: "Generate", uk: "Згенерувати" },
  generating: { sk: "Generujem...", en: "Generating...", uk: "Генерую..." },

  mustWait: {
    sk: "Generovanie môže trvať 2–3 minúty. Neodchádzaj a nerefrešuj stránku.",
    en: "Generation may take 2–3 minutes. Please don't refresh or leave the page.",
    uk: "Генерація може тривати 2–3 хвилини. Не оновлюй і не покидай сторінку.",
  },

  inactivePaywall: {
    sk: "Tvoje členstvo nie je aktívne. Generovanie je pozastavené, ale dáta ostávajú dostupné v profile.",
    en: "Your subscription is not active. Generation is paused, but your data remains available in your profile.",
    uk: "Підписка не активна. Генерація призупинена, але дані доступні у профілі.",
  },

  goPricing: { sk: "Prejsť na cenník", en: "Go to pricing", uk: "Перейти до тарифів" },

  remainingThisWeek: {
    sk: "Zostáva generovaní pre tento týždeň:",
    en: "Generations remaining for this week:",
    uk: "Залишилось генерацій на цей тиждень:",
  },

  overwriteTitle: {
    sk: "Tento týždeň už má uložený jedálniček.",
    en: "A plan for this week already exists.",
    uk: "План на цей тиждень вже існує.",
  },
  overwriteAsk: {
    sk: "Chceš ho prepísať novým generovaním?",
    en: "Do you want to overwrite it with a new generation?",
    uk: "Хочеш перезаписати його новою генерацією?",
  },
  overwriteYes: { sk: "Áno, vygenerovať nový", en: "Yes, generate new", uk: "Так, згенерувати новий" },
  overwriteNo: { sk: "Nie, ponechať aktuálny", en: "No, keep current", uk: "Ні, залишити поточний" },

  language: { sk: "Jazyk", en: "Language", uk: "Мова" },
};