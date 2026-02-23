import { NextResponse } from "next/server";

type Body = {
  weekStart?: string; // YYYY-MM-DD (pondelok)
  language?: string; // "sk"

  people: string;
  budget: string;

  intolerances?: string;
  avoid?: string;
  have?: string;
  favorites?: string;

  style?: string;
  shoppingTrips?: string;
  repeatDays?: string;
};

type Recipe = {
  title: string;
  time_min: number;
  portions: number;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: string[];
};

function extractText(data: any): string {
  if (!data) return "";
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;

  const out = data.output;
  if (!Array.isArray(out)) return "";

  const chunks: string[] = [];
  for (const item of out) {
    if (item?.type === "output_text" && typeof item.text === "string") {
      chunks.push(item.text);
      continue;
    }
    if (Array.isArray(item?.content)) {
      for (const c of item.content) {
        if (c?.type === "output_text" && typeof c.text === "string") chunks.push(c.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function safeParseJSON(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const maybe = text.slice(start, end + 1);
      try {
        return JSON.parse(maybe);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function addDaysISO(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const DAY_NAMES_SK = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];

function styleHintFromValue(style: string) {
  switch (style) {
    case "rychle":
      return "Uprednostni veľmi rýchle jedlá (max 20–30 min).";
    case "vyvazene":
      return "Uprednostni vyvážené jedlá (bielkoviny, zelenina, prílohy), stále rozumná cena.";
    case "vegetarianske":
      return "Vegetariánske: bez mäsa a rýb (vajcia a mliečne OK).";
    case "tradicne":
      return "Tradičné: domáca poctivá strava (klasické slovenské/európske jedlá).";
    case "exoticke":
      return "Exotické: inšpirácie Ázia/Mexiko/fusion, bežné suroviny z obchodu.";
    case "fit":
      return "Fit: viac bielkovín, viac zeleniny, menej cukru, striedme porcie.";
    case "lacné":
    default:
      return "Uprednostni čo najlacnejšie jedlá z bežných surovín.";
  }
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function normalizeRecipeKey(key: string) {
  const k = (key || "").trim();
  if (!k) return k;
  const m1 = k.match(/^d(\d)(breakfast|lunch|dinner)$/i);
  if (m1) return `d${m1[1]}_${m1[2].toLowerCase()}`;
  const m2 = k.match(/^d(\d)[\-_](breakfast|lunch|dinner)$/i);
  if (m2) return `d${m2[1]}_${m2[2].toLowerCase()}`;
  return k;
}

function expectedRecipeKeys() {
  const keys: string[] = [];
  for (let d = 1; d <= 7; d++) {
    keys.push(`d${d}_breakfast`, `d${d}_lunch`, `d${d}_dinner`);
  }
  return keys;
}

function coerceNumber(x: any): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function ensureKcalAndSummary(plan: any, people: number) {
  if (!plan || typeof plan !== "object") return plan;

  plan.summary = plan.summary && typeof plan.summary === "object" ? plan.summary : {};
  plan.days = Array.isArray(plan.days) ? plan.days : [];

  // Kalórie VSTUP: chceme per person na deň
  let weeklyPerPerson = 0;

  for (const d of plan.days) {
    if (!d || typeof d !== "object") continue;

    const bk = coerceNumber(d.breakfast_kcal);
    const lk = coerceNumber(d.lunch_kcal);
    const dk = coerceNumber(d.dinner_kcal);

    // ak niečo chýba, necháme null (radšej), ale total sa pokúsime dopočítať len ak sú všetky tri
    d.breakfast_kcal = bk ?? d.breakfast_kcal;
    d.lunch_kcal = lk ?? d.lunch_kcal;
    d.dinner_kcal = dk ?? d.dinner_kcal;

    const allThree = typeof bk === "number" && typeof lk === "number" && typeof dk === "number";
    const total = allThree ? bk + lk + dk : coerceNumber(d.total_kcal);

    d.total_kcal = typeof total === "number" ? Math.round(total) : d.total_kcal;

    if (typeof d.total_kcal === "number" && Number.isFinite(d.total_kcal)) {
      weeklyPerPerson += d.total_kcal;
    }
  }

  // summary per person
  const daysCount = plan.days.length || 7;
  const avgPerPerson = daysCount ? weeklyPerPerson / daysCount : 0;

  plan.summary.weekly_total_kcal_per_person = Math.round(weeklyPerPerson);
  plan.summary.avg_daily_kcal_per_person = Math.round(avgPerPerson);

  // summary household (people × per person)
  plan.summary.people = typeof plan.summary.people === "number" ? plan.summary.people : people;
  plan.summary.weekly_total_kcal = Math.round(weeklyPerPerson * people);
  plan.summary.avg_daily_kcal = Math.round(avgPerPerson * people);

  return plan;
}

function normalizePlan(plan: any) {
  if (!plan || typeof plan !== "object") return plan;

  // ensure arrays
  plan.days = Array.isArray(plan.days) ? plan.days.slice(0, 7) : [];
  plan.shopping = Array.isArray(plan.shopping) ? plan.shopping : [];

  // normalize recipes keys
  if (plan.recipes && typeof plan.recipes === "object") {
    const fixed: Record<string, Recipe> = {};
    for (const [k, v] of Object.entries(plan.recipes)) {
      fixed[normalizeRecipeKey(k)] = v as Recipe;
    }
    plan.recipes = fixed;
  } else {
    plan.recipes = {};
  }

  return plan;
}

function getMissingRecipeKeys(plan: any) {
  const want = expectedRecipeKeys();
  const have = new Set<string>(Object.keys(plan?.recipes || {}).map(normalizeRecipeKey));
  return want.filter((k) => !have.has(k));
}

async function callOpenAIJSON(apiKey: string, prompt: string) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(`OpenAI error: ${JSON.stringify(data)}`);

  const text = extractText(data);
  const parsed = safeParseJSON(text);
  return { text, parsed };
}

function buildRecipesRepairPrompt(plan: any, missingKeys: string[], languageRule: string) {
  // aby recepty sedeli na názvy jedál, pošleme mapu key -> názov jedla z days
  const days = Array.isArray(plan?.days) ? plan.days : [];
  const nameMap: Record<string, string> = {};

  for (const d of days) {
    const day = d?.day;
    if (!day) continue;
    nameMap[`d${day}_breakfast`] = d.breakfast || "";
    nameMap[`d${day}_lunch`] = d.lunch || "";
    nameMap[`d${day}_dinner`] = d.dinner || "";
  }

  return `
Vráť IBA validný JSON (žiadny iný text).
${languageRule}

Potrebujem doplniť CHÝBAJÚCE recepty do objektu "recipes". Nemeň nič iné.
Vráť iba tento tvar:

{
  "recipes": {
    "<key>": {
      "title": string,
      "time_min": number,
      "portions": number,
      "ingredients": [{ "name": string, "quantity": string }],
      "steps": string[]
    }
  }
}

Chýbajúce kľúče (vráť presne tieto a žiadne iné):
${missingKeys.map((k) => `- ${k}`).join("\n")}

Názvy jedál (aby recept sedel na konkrétne jedlo):
${missingKeys
  .map((k) => `- ${k}: ${JSON.stringify(nameMap[k] || "")}`)
  .join("\n")}

Pravidlá:
- Každý missing key MUSÍ mať recept.
- "portions" nastav na počet porcií pre domácnosť (nie per person).
- Kroky píš stručne, ale komplet.
- Quantity realistické (napr. "1 kg", "500 g", "2 ks", "1 bal").
`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chýba OPENAI_API_KEY v .env.local" }, { status: 500 });
    }

    const peopleRaw = body.people?.trim() || "1";
    const budgetRaw = body.budget?.trim() || "0";

    const peopleNum = clampInt(Number(peopleRaw), 1, 6);
    const budgetNum = clampInt(Number(budgetRaw), 1, 1000);

    const intolerances = (body.intolerances || "").trim();
    const avoid = (body.avoid || "").trim();
    const have = (body.have || "").trim();
    const favorites = (body.favorites || "").trim();

    const style = (body.style || "lacné").trim();
    const shoppingTrips = clampInt(Number(body.shoppingTrips || 2), 1, 4);
    const repeatDays = clampInt(Number(body.repeatDays || 2), 1, 3);

    const weekStart = (body.weekStart || "").trim();
    const lang = (body.language || "sk").trim().toLowerCase();

    const styleHint = styleHintFromValue(style);

    const datesBlock =
      weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
        ? DAY_NAMES_SK.map((name, i) => `- day ${i + 1}: ${name}, date: ${addDaysISO(weekStart, i)}`).join("\n")
        : "";

    const languageRule = lang === "sk" ? "Všetko píš po slovensky." : "Language: use the requested language.";

    // ✅ DÔLEŽITÉ: recepty už nie "aspoň lunch/dinner", ale PRE KAŽDÉ jedlo
    const prompt = `
Vráť IBA validný JSON (žiadny iný text).
${languageRule}

Vytvor 7-dňový jedálniček (raňajky/obed/večera) pre domácnosť.
Cieľ: šetriť čas aj peniaze.

Parametre:
- people: ${peopleNum}
- weekly_budget_eur: ${budgetNum}
- shopping_trips_per_week: ${shoppingTrips}
- repeat_days_max: ${repeatDays}

TVRDÉ obmedzenie:
- forbidden_ingredients (nesmú byť použité): ${intolerances || "none"}

Preferencie:
- avoid: ${avoid || "none"}
- favorites: ${favorites || "none"}
- have_at_home: ${have || "none"}

Štýl:
- ${styleHint}

Týždeň (ak je zadaný):
${datesBlock || "- (no dates provided)"}

Pravidlá:
- Nadväzuj jedlá (batch cooking), aby človek nevaril 3× denne každý deň.
- Opakuj suroviny naprieč dňami (minimalizuj odpad).
- Rozdeľ nákup do ${shoppingTrips} nákupov podľa dní.
- Uvádzaj názvy jedál prirodzene po slovensky.
- V "days" doplň aj day_name + date.

KALÓRIE:
- Kalórie uvádzaj PER PERSON (na 1 porciu).
- Ku každému jedlu daj odhad kalórií v kcal (breakfast_kcal, lunch_kcal, dinner_kcal).
- Pridaj total_kcal pre deň = súčet 3 jedál (per person).

NÁKUPY:
- Okrem celkového odhadu týždňa uveď aj odhad ceny pre každý nákup: estimated_cost_eur na úrovni shopping trip.

RECEPTY (KRITICKÉ):
- MUSÍŠ vygenerovať recept pre KAŽDÉ jedlo (raňajky + obed + večera) pre každý deň.
- To je spolu 21 receptov.
- Kľúče receptov: d{day}_{meal}, kde meal je breakfast | lunch | dinner.
- Recept musí zodpovedať názvu jedla v days (title nech sedí na názov jedla).
- "portions" nastav pre CELÚ domácnosť (people), nie per person.

JSON schéma (dodrž presne):
{
  "summary": {
    "people": number,
    "weekly_budget_eur": number,
    "shopping_trips_per_week": number,
    "repeat_days_max": number,
    "estimated_total_cost_eur": number,
    "savings_tips": string[],
    "weekly_total_kcal": number,
    "avg_daily_kcal": number
  },
  "days": [
    {
      "day": 1,
      "day_name": string,
      "date": "YYYY-MM-DD",
      "breakfast": string,
      "lunch": string,
      "dinner": string,
      "note": string,
      "breakfast_kcal": number,
      "lunch_kcal": number,
      "dinner_kcal": number,
      "total_kcal": number
    }
  ],
  "shopping": [
    {
      "trip": 1,
      "covers_days": "1-3",
      "estimated_cost_eur": number,
      "items": [
        { "name": string, "quantity": string }
      ]
    }
  ],
  "recipes": {
    "d1_breakfast": {
      "title": string,
      "time_min": number,
      "portions": number,
      "ingredients": [{ "name": string, "quantity": string }],
      "steps": string[]
    }
  }
}

Počet položiek:
- days musí mať presne 7 dní (day 1..7)
- shopping musí mať presne ${shoppingTrips} nákupov (trip 1..${shoppingTrips})
- recipes MUSÍ mať presne 21 kľúčov (d1_breakfast..d7_dinner)
`;

    // 1) prvý call
    const first = await callOpenAIJSON(apiKey, prompt);

    if (!first.parsed) {
      return NextResponse.json({ kind: "text", text: first.text }, { status: 200 });
    }

    let plan = normalizePlan(first.parsed);

    // 2) tvrdá validácia receptov + repair (max 2 pokusy)
    let missing = getMissingRecipeKeys(plan);

    if (missing.length > 0) {
      const repairPrompt = buildRecipesRepairPrompt(plan, missing, languageRule);

      const repair = await callOpenAIJSON(apiKey, repairPrompt);
      if (repair.parsed && repair.parsed.recipes && typeof repair.parsed.recipes === "object") {
        const repairedRecipes: Record<string, Recipe> = {};
        for (const [k, v] of Object.entries(repair.parsed.recipes)) {
          repairedRecipes[normalizeRecipeKey(k)] = v as Recipe;
        }

        plan.recipes = plan.recipes && typeof plan.recipes === "object" ? plan.recipes : {};
        plan.recipes = { ...plan.recipes, ...repairedRecipes };
      }

      // re-check
      plan = normalizePlan(plan);
      missing = getMissingRecipeKeys(plan);
    }

    // ak aj po repair stále chýba, vrátime error (radšej ako uložiť poloplan)
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: {
            message: "Generovanie zlyhalo: chýbajú recepty pre niektoré jedlá.",
            missing_recipe_keys: missing,
          },
        },
        { status: 500 }
      );
    }

    // 3) doplň kcal summary (per person aj household)
    plan = ensureKcalAndSummary(plan, peopleNum);

    // 4) ešte základné sanity fields
    plan.summary = plan.summary ?? {};
    plan.summary.people = peopleNum;
    plan.summary.weekly_budget_eur = budgetNum;
    plan.summary.shopping_trips_per_week = shoppingTrips;
    plan.summary.repeat_days_max = repeatDays;

    return NextResponse.json({ kind: "json", plan }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}