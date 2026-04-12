//src/app/api/generate/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  weekStart?: string;
  language?: string;
  people: string;
  budget: string;
  intolerances?: string;
  avoid?: string;
  have?: string;
  favorites?: string;
  specifications?: string;
  style?: string;
  shoppingTrips?: string;
  repeatDays?: string;
};

type Plan = "basic" | "plus";
type Status = "inactive" | "trialing" | "active" | "past_due" | "canceled";

type ParsedQuantity = {
  amount: number;
  unit: string;
  consumed: string;
};

type IngredientUsage = {
  day: number;
  canonical_name: string;
  display_name: string;
  amount: number;
  unit: string;
  category_key: string;
};

type PantryStock = {
  canonical_name: string;
  display_name: string;
  amount: number;
  unit: string;
};

type PriceHint = {
  price_per_unit: number;
  samples: number;
};

type TripRange = {
  trip: number;
  from: number;
  to: number;
  covers_days: string;
};

const DAY_NAMES_SK = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];

const NAME_STOPWORDS = new Set([
  "cerstvy",
  "cerstva",
  "cerstve",
  "zrely",
  "zrela",
  "zrele",
  "velky",
  "velka",
  "velke",
  "maly",
  "mala",
  "male",
  "domaci",
  "domaca",
  "domace",
  "bio",
  "nakrajany",
  "nakrajana",
  "nakrajane",
  "krajany",
  "krajana",
  "krajane",
  "vareny",
  "varena",
  "varene",
  "uvareny",
  "uvarena",
  "uvarene",
  "duseny",
  "dusena",
  "dusene",
  "peceny",
  "pecena",
  "pecene",
  "surovy",
  "surova",
  "surove",
  "jemny",
  "jemna",
  "jemne",
  "hladky",
  "hladka",
  "hladke",
  "biely",
  "biela",
  "biele",
  "cely",
  "cela",
  "cele",
  "polotucny",
  "polotucna",
  "polotucne",
  "bez",
  "kosti",
  "koste",
  "kostou",
]);

const SIMPLE_ALIASES: Record<string, string> = {
  banan: "banan",
  banany: "banan",
  zemiak: "zemiak",
  zemiaky: "zemiak",
  zemiakov: "zemiak",
  vajce: "vajce",
  vajcia: "vajce",
  vajec: "vajce",
  kuracie: "kuraci",
  hovadzie: "hovadzi",
  bravcove: "bravcovi",
  ryza: "ryza",
  ryze: "ryza",
  paradajka: "paradajka",
  paradajky: "paradajka",
  uhorka: "uhorka",
  uhorky: "uhorka",
  papriky: "paprika",
  paprika: "paprika",
  jablko: "jablko",
  jablka: "jablko",
  jahoda: "jahoda",
  jahody: "jahoda",
  cucoriedka: "cucoriedka",
  cucoriedky: "cucoriedka",
  slahacka: "smotana",
  smotana: "smotana",
  tvaroh: "tvaroh",
  jogurt: "jogurt",
  syr: "syr",
  syra: "syr",
  sunka: "sunka",
  sunky: "sunka",
  huby: "huba",
  sampinon: "sampinon",
  sampinony: "sampinon",
  brokolica: "brokolica",
  kuskus: "kuskus",
  "kus kus": "kuskus",
  vlocky: "vlocky",
  ovsene: "ovseny",
  vločka: "vlocky",
  vločky: "vlocky",
};

function planLimits(plan: Plan) {
  if (plan === "plus") {
    return {
      weekly_limit: 5,
      calories_enabled: true,
      allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske", "veganske", "fit", "tradicne", "exoticke"],
    };
  }
  return {
    weekly_limit: 3,
    calories_enabled: false,
    allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske"],
  };
}

function parseDateMs(v?: string | null) {
  if (!v) return null;

  let s = v.trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
  }

  if (/[+-]\d{2}$/.test(s)) {
    s = s + ":00";
  }

  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

function isActiveLike(status: Status, nowMs: number, currentPeriodEnd?: string | null, trialUntil?: string | null) {
  if (status === "active") {
    const cpe = parseDateMs(currentPeriodEnd);
    if (!cpe) return true;
    return cpe > nowMs;
  }
  if (status === "trialing") {
    const tu = parseDateMs(trialUntil);
    if (!tu) return false;
    return tu > nowMs;
  }
  return false;
}

function coerceNumber(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parsePeople(v: string) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 6) return null;
  return n;
}

function parseBudget(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 1000) return null;
  return n;
}

async function requireActiveSubscription(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const { data: subRow, error } = await supabase
    .from("subscriptions")
    .select("plan,status,current_period_end,trial_until,stripe_customer_id,stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      payload: { error: { code: "SUBSCRIPTION_READ_FAILED", message: error.message } },
    };
  }

  if (!subRow) {
    return {
      ok: false as const,
      status: 402,
      payload: { error: { code: "SUBSCRIPTION_INACTIVE", status: "none" } },
    };
  }

  const planTier = ((subRow.plan as Plan) || "basic") as Plan;
  const status = ((subRow.status as Status) || "inactive") as Status;

  const nowMs = Date.now();
  const activeLike = isActiveLike(
    status,
    nowMs,
    subRow.current_period_end ?? null,
    subRow.trial_until ?? null
  );
  const hasStripeLink = !!(subRow.stripe_customer_id || subRow.stripe_subscription_id);

  if (!activeLike || !hasStripeLink) {
    return {
      ok: false as const,
      status: 402,
      payload: {
        error: {
          code: "SUBSCRIPTION_INACTIVE",
          plan: planTier,
          status,
          reason: !hasStripeLink ? "MISSING_STRIPE_LINK" : "NOT_ACTIVE",
        },
      },
    };
  }

  return { ok: true as const, planTier };
}

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function addDaysISO(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function styleHintFromValue(style: string) {
  switch (style) {
    case "rychle":
      return "Uprednostni veľmi rýchle jedlá (max 20–30 min).";
    case "vyvazene":
      return "Uprednostni vyvážené jedlá (bielkoviny, zelenina, prílohy). Dostupný budget využi realisticky na pestrosť, kvalitnejšie suroviny a nutrične vyvážené jedlá.";
    case "vegetarianske":
      return "Vegetariánske: bez mäsa a rýb (vajcia a mliečne OK).";
    case "veganske":
      return "Vegánske: bez mäsa, rýb, vajec, mliečnych výrobkov, medu a všetkých živočíšnych produktov.";
    case "tradicne":
      return "Tradičné: domáca poctivá strava.";
    case "exoticke":
      return "Exotické: inšpirácie Ázia/Mexiko/fusion.";
    case "fit":
      return "Fit: viac bielkovín, viac zeleniny, menej cukru.";
    default:
      return "Uprednostni praktické a lacnejšie jedlá z bežných surovín, ale budget využi rozumne a nie zbytočne príliš nízko.";
  }
}

function getPromptVariantsForStyle(style: string): string[] {
  switch (style) {
    case "lacné":
      return [
        "V rámci lacného štýlu sa snaž o miernu pestrosť medzi dňami a neopakuj stále ten istý typ jedál alebo príloh.",
        "Aj pri lacných surovinách obmieňaj hlavné prílohy, spôsob použitia zeleniny a typ jedál počas týždňa.",
        "Zachovaj nízku cenu, ale nech dni nepôsobia ako len malé obmeny toho istého jedla.",
      ];
    case "rychle":
      return [
        "Zachovaj rýchlosť, ale striedaj typy jedál a techniky prípravy, aby susedné dni nepôsobili príliš podobne.",
        "Aj pri rýchlych jedlách obmieňaj prílohy, chute a hlavné kombinácie surovín.",
        "Uprednostni rýchle jedlá, ale dbaj na miernu pestrosť medzi dňami a vyhni sa príliš podobným rýchlym kombináciám.",
      ];
    case "vyvazene":
      return [
        "V rámci vyváženého štýlu striedaj zdroje bielkovín, zeleninu a hlavné prílohy počas týždňa.",
        "Dbaj na to, aby dni pôsobili pestrejšie a neopakovali sa stále tie isté kombinácie bielkovina + príloha.",
        "Zachovaj vyváženosť, ale obmieňaj chuťové profily, zeleninu aj hlavné bázy jedál.",
      ];
    case "vegetarianske":
      return [
        "Pri vegetariánskom štýle striedaj typy jedál, aby sa neopakovali stále rovnaké kombinácie syra, vajec a zeleniny.",
        "Použi rôzne vegetariánske základy a obmieňaj prílohy, strukoviny, syry a zeleninu.",
        "Zachovaj vegetariánsky štýl, ale dbaj na pestrosť chutí, textúr a hlavných surovín počas týždňa.",
      ];
    case "veganske":
      return [
        "Pri vegánskom štýle striedaj rastlinné bielkoviny, prílohy a zeleninu, aby týždeň nepôsobil monotónne.",
        "Zachovaj vegánsky štýl, ale obmieňaj hlavné bázy jedál a chuťové profily počas týždňa.",
        "Použi pestrejšie kombinácie strukovín, obilnín, zeleniny a príloh pri zachovaní praktickosti.",
      ];
    case "tradicne":
      return [
        "Zachovaj tradičný charakter, ale nevyberaj príliš podobné tradičné jedlá po sebe.",
        "Pri tradičnom štýle obmieňaj typy príloh, druhy mäsa a spôsob prípravy jedál počas týždňa.",
        "Aj pri tradičných jedlách dbaj na miernu pestrosť, aby dni nepôsobili príliš jednotvárne.",
      ];
    case "exoticke":
      return [
        "Zachovaj exotický štýl, ale striedaj chuťové profily a nenechaj týždeň stáť len na jednom type cuisine.",
        "Pri exotickom štýle obmieňaj techniky prípravy, hlavné prílohy aj koreniny počas týždňa.",
        "Dbaj na pestrosť exotických inšpirácií, ale stále používaj praktické a bežne dostupné suroviny.",
      ];
    case "fit":
      return [
        "Zachovaj fit štýl, ale striedaj zdroje bielkovín, prílohy a typy zeleniny počas týždňa.",
        "Pri fit štýle dbaj na pestrosť jedál, aby sa neopakovali stále rovnaké kombinácie kura + ryža + zelenina.",
        "Zachovaj vyšší obsah bielkovín a ľahší charakter, ale obmieňaj chute, formu jedál a prílohy.",
      ];
    default:
      return [
        "Dbaj na miernu pestrosť medzi dňami a neopakuj stále ten istý typ jedál alebo príloh.",
        "Aj pri podobných surovinách sa snaž o odlišné kombinácie a rôzne spracovanie počas týždňa.",
        "Nech susedné dni nepôsobia ako len malé obmeny toho istého jedla.",
      ];
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function requiredRecipeKeys() {
  const keys: string[] = [];
  for (let d = 1; d <= 7; d++) keys.push(`d${d}_breakfast`, `d${d}_lunch`, `d${d}_dinner`);
  return keys;
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

function normalizePlan(plan: any) {
  const next = JSON.parse(JSON.stringify(plan ?? {}));

  if (next.recipes && typeof next.recipes === "object") {
    const fixed: Record<string, any> = {};
    for (const [k, v] of Object.entries(next.recipes)) fixed[normalizeRecipeKey(k)] = v;
    next.recipes = fixed;
  }

  if (Array.isArray(next.days)) next.days = next.days.slice(0, 7);
  return next;
}

function ensurePerPersonCalories(summary: any) {
  const people = Math.max(1, coerceNumber(summary?.people, 1));
  const avg = coerceNumber(summary?.avg_daily_kcal, 0);
  const weekly = coerceNumber(summary?.weekly_total_kcal, 0);
  summary.avg_daily_kcal_per_person = people ? Math.round(avg / people) : null;
  summary.weekly_total_kcal_per_person = people ? Math.round(weekly / people) : null;
  return summary;
}

function sumShoppingEstimates(plan: any) {
  const shopping = Array.isArray(plan?.shopping) ? plan.shopping : [];
  let total = 0;

  for (const trip of shopping) {
    const items = Array.isArray(trip?.items) ? trip.items : [];
    let tripTotal = 0;

    for (const item of items) {
      const v = Number(item?.estimated_price_eur);
      if (Number.isFinite(v) && v >= 0) tripTotal += v;
    }

    trip.estimated_cost_eur = Number(tripTotal.toFixed(2));
    total += tripTotal;
  }

  plan.summary = plan.summary ?? {};
  plan.summary.estimated_total_cost_eur = Number(total.toFixed(2));
  return plan;
}

function normalizeShoppingCoversDays(plan: any, shoppingTrips: number) {
  if (!Array.isArray(plan?.shopping)) return plan;

  const trips = plan.shopping;

  if (shoppingTrips === 1 && trips[0]) {
    trips[0].covers_days = "1-7";
    return plan;
  }

  if (shoppingTrips === 2) {
    if (trips[0]) trips[0].covers_days = "1-3";
    if (trips[1]) trips[1].covers_days = "4-7";
    return plan;
  }

  if (shoppingTrips === 3) {
    if (trips[0]) trips[0].covers_days = "1-2";
    if (trips[1]) trips[1].covers_days = "3-4";
    if (trips[2]) trips[2].covers_days = "5-7";
    return plan;
  }

  if (shoppingTrips === 4) {
    if (trips[0]) trips[0].covers_days = "1-2";
    if (trips[1]) trips[1].covers_days = "3-4";
    if (trips[2]) trips[2].covers_days = "5-6";
    if (trips[3]) trips[3].covers_days = "7-7";
    return plan;
  }

  return plan;
}

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeBaseName(name: string) {
  return normalizeSpaces(
    stripDiacritics(
      (name || "")
        .toLowerCase()
        .replace(/(\d)([a-zA-Z])/g, "$1 $2")
        .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    )
      .replace(/[()]/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
  );
}

function normalizeToken(token: string) {
  const t = normalizeBaseName(token);
  if (!t) return "";

  if (SIMPLE_ALIASES[t]) return SIMPLE_ALIASES[t];

  if (t.endsWith("ami") && t.length > 5) return t.slice(0, -3);
  if (t.endsWith("och") && t.length > 5) return t.slice(0, -3);
  if (t.endsWith("ove") && t.length > 5) return t.slice(0, -1);
  if (t.endsWith("ovej") && t.length > 6) return t.slice(0, -3);
  if (t.endsWith("ych") && t.length > 5) return t.slice(0, -3);
  if (t.endsWith("ami") && t.length > 5) return t.slice(0, -3);
  if (t.endsWith("y") && t.length > 4) return t.slice(0, -1);
  if (t.endsWith("i") && t.length > 4) return t.slice(0, -1);

  return t;
}

function canonicalIngredientName(name: string) {
  const base = normalizeBaseName(name);
  if (!base) return "";

  const tokens = base
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !NAME_STOPWORDS.has(x))
    .map(normalizeToken)
    .filter(Boolean);

  return tokens.join(" ");
}

function prettifyDisplayName(name: string) {
  return normalizeSpaces((name || "").trim().replace(/\s+/g, " "));
}

function parseSimpleNumber(raw: string) {
  const s = raw.replace(",", ".").trim();

  if (/^\d+\s+\d+\/\d+$/.test(s)) {
    const [whole, frac] = s.split(/\s+/);
    const [a, b] = frac.split("/");
    const n = Number(whole) + Number(a) / Number(b);
    return Number.isFinite(n) ? n : null;
  }

  if (/^\d+\/\d+$/.test(s)) {
    const [a, b] = s.split("/");
    const n = Number(a) / Number(b);
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeUnit(raw: string) {
  const u = normalizeBaseName(raw);

  if (!u) return "ks";

  if (["kg", "kilogram", "kilogramy", "kilogramov"].includes(u)) return "g";
  if (["g", "gram", "gramy", "gramov"].includes(u)) return "g";
  if (["l", "liter", "litre", "litrov"].includes(u)) return "ml";
  if (["ml", "mililiter", "mililitre", "mililitrov"].includes(u)) return "ml";

  if (["ks", "kus", "kusy", "kusov"].includes(u)) return "ks";
  if (["konzerva", "konzervy", "konzerv"].includes(u)) return "konzerva";
  if (["balenie", "balenia", "baleni"].includes(u)) return "balenie";
  if (["bochnik", "bochnik", "bochniky", "bochnikov"].includes(u)) return "bochnik";
  if (["hlavka", "hlavky", "hlavok"].includes(u)) return "hlavka";
  if (["strucik", "struciky", "strucikov"].includes(u)) return "strucik";
  if (["platok", "platky", "platkov"].includes(u)) return "platok";
  if (["lyzica", "lyzice", "lyzic", "lyzicka", "lyzicky", "lyziciek"].includes(u)) return "lyzica";

  return u;
}

function toBaseAmount(amount: number, rawUnit: string) {
  const normalized = normalizeUnit(rawUnit);
  const raw = normalizeBaseName(rawUnit);

  if (normalized === "g" && ["kg", "kilogram", "kilogramy", "kilogramov"].includes(raw)) return amount * 1000;
  if (normalized === "ml" && ["l", "liter", "litre", "litrov"].includes(raw)) return amount * 1000;

  return amount;
}

function parseQuantityPrefix(input: string): ParsedQuantity | null {
  const normalized = normalizeBaseName(input);
  if (!normalized) return null;

  const m = normalized.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*([a-z]+(?:\s+[a-z]+)?))?/i);
  if (!m) return null;

  const amount = parseSimpleNumber(m[1]);
  if (amount == null || amount <= 0) return null;

  let unitRaw = (m[2] || "").trim();
  let consumed = m[1];

  if (unitRaw) {
    const unitWords = unitRaw.split(" ");
    const first = unitWords[0] || "";
    const second = unitWords.slice(0, 2).join(" ");

    const knownTwoWord = ["velky bochnik", "maly bochnik"];
    const knownOneWord = [
      "kg",
      "g",
      "l",
      "ml",
      "ks",
      "kus",
      "kusy",
      "kusov",
      "konzerva",
      "konzervy",
      "balenie",
      "balenia",
      "bochnik",
      "hlavka",
      "hlavky",
      "strucik",
      "struciky",
      "platok",
      "platky",
      "lyzica",
      "lyzice",
      "lyzicka",
      "lyzicky",
    ];

    if (knownTwoWord.includes(second)) {
      unitRaw = second;
      consumed = `${m[1]} ${second}`;
    } else if (knownOneWord.includes(first)) {
      unitRaw = first;
      consumed = `${m[1]} ${first}`;
    } else {
      unitRaw = "ks";
      consumed = m[1];
    }
  } else {
    unitRaw = "ks";
    consumed = m[1];
  }

  return {
    amount: toBaseAmount(amount, unitRaw),
    unit: normalizeUnit(unitRaw),
    consumed,
  };
}

function parseAmountAndUnit(rawAmount: string, rawUnit: string) {
  const amount = parseSimpleNumber(rawAmount);
  if (amount == null || amount <= 0) return null;

  return {
    amount: toBaseAmount(amount, rawUnit),
    unit: normalizeUnit(rawUnit),
  };
}

function parseQuantityAnywhere(input: string) {
  const raw = (input || "").trim();
  if (!raw) return null;

  const normalized = normalizeBaseName(raw);

  const patterns = [
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|ks|kus|kusy|kusov|konzerva|konzervy|balenie|balenia|bochnik|hlavka|hlavky|strucik|struciky|platok|platky|lyzica|lyzice|lyzicka|lyzicky)\s+(.+)$/i,
    /^(.+?)\s+(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|ks|kus|kusy|kusov|konzerva|konzervy|balenie|balenia|bochnik|hlavka|hlavky|strucik|struciky|platok|platky|lyzica|lyzice|lyzicka|lyzicky)$/i,
    /^(.+?)\s*[-:]\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|ks|kus|kusy|kusov|konzerva|konzervy|balenie|balenia|bochnik|hlavka|hlavky|strucik|struciky|platok|platky|lyzica|lyzice|lyzicka|lyzicky)$/i,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    const m = normalized.match(p);
    if (!m) continue;

    if (i === 0) {
      const parsed = parseAmountAndUnit(m[1], m[2]);
      if (!parsed) continue;

      return {
        name: prettifyDisplayName(m[3]),
        amount: parsed.amount,
        unit: parsed.unit,
      };
    }

    const parsed = parseAmountAndUnit(m[2], m[3]);
    if (!parsed) continue;

    return {
      name: prettifyDisplayName(m[1]),
      amount: parsed.amount,
      unit: parsed.unit,
    };
  }

  return null;
}

function formatQuantity(amount: number, unit: string) {
  if (!Number.isFinite(amount) || amount <= 0) return "";

  if (unit === "g") {
    if (amount >= 1000 && amount % 1000 === 0) return `${amount / 1000} kg`;
    if (amount >= 1000) return `${Number((amount / 1000).toFixed(2))} kg`;
    return `${Math.round(amount)} g`;
  }

  if (unit === "ml") {
    if (amount >= 1000 && amount % 1000 === 0) return `${amount / 1000} l`;
    if (amount >= 1000) return `${Number((amount / 1000).toFixed(2))} l`;
    return `${Math.round(amount)} ml`;
  }

  if (unit === "ks") return `${Number(amount.toFixed(2))} ks`;
  if (unit === "konzerva") return `${Number(amount.toFixed(2))} konzervy`;
  if (unit === "balenie") return `${Number(amount.toFixed(2))} balenia`;
  if (unit === "bochnik") return `${Number(amount.toFixed(2))} bochník`;
  if (unit === "hlavka") return `${Number(amount.toFixed(2))} hlávky`;
  if (unit === "strucik") return `${Number(amount.toFixed(2))} strúčiky`;
  if (unit === "platok") return `${Number(amount.toFixed(2))} plátky`;
  if (unit === "lyzica") return `${Number(amount.toFixed(2))} lyžice`;

  return `${Number(amount.toFixed(2))} ${unit}`;
}

function inferCategoryKey(name: string) {
  const n = canonicalIngredientName(name);

  if (/(paradajk|uhork|paprik|cibul|cesnak|mrkv|zemiak|salat|brokolic|karfiol|cuket|spenat|zelenin|petrzlen)/.test(n))
    return "veg";
  if (/(jablk|banan|hrusk|pomaranc|citron|kiwi|jahod|malin|hrozn|cucoried)/.test(n)) return "fruit";
  if (/(kurac|hovadz|bravc|mlet|slan|sunka|klobas|morcac)/.test(n)) return "meat";
  if (/(losos|tuniak|tresk|pstruh|ryb)/.test(n)) return "fish";
  if (/(mliek|jogurt|syr|tvaroh|smotan|maslo|mozzarel|parmez|vajce)/.test(n)) return "dairy";
  if (/(chlieb|rozok|baget|tortill|toast|zeml|bochnik)/.test(n)) return "bakery";
  if (/(ryza|cestov|muk|ovsen|sosov|cicer|fazul|konzerv|olej|kuskus|muesli|musli)/.test(n)) return "dry";
  if (/(mrazen)/.test(n)) return "frozen";
  if (/(sol|koren|rasc|kari|oregano|bazalk|skoric|paprika)/.test(n)) return "spices";

  return "other";
}

function getTripRanges(shoppingTrips: number): TripRange[] {
  if (shoppingTrips === 1) return [{ trip: 1, from: 1, to: 7, covers_days: "1-7" }];
  if (shoppingTrips === 2) {
    return [
      { trip: 1, from: 1, to: 3, covers_days: "1-3" },
      { trip: 2, from: 4, to: 7, covers_days: "4-7" },
    ];
  }
  if (shoppingTrips === 3) {
    return [
      { trip: 1, from: 1, to: 2, covers_days: "1-2" },
      { trip: 2, from: 3, to: 4, covers_days: "3-4" },
      { trip: 3, from: 5, to: 7, covers_days: "5-7" },
    ];
  }
  return [
    { trip: 1, from: 1, to: 2, covers_days: "1-2" },
    { trip: 2, from: 3, to: 4, covers_days: "3-4" },
    { trip: 3, from: 5, to: 6, covers_days: "5-6" },
    { trip: 4, from: 7, to: 7, covers_days: "7-7" },
  ];
}

function tripForDay(day: number, shoppingTrips: number) {
  const ranges = getTripRanges(shoppingTrips);
  return ranges.find((r) => day >= r.from && day <= r.to)?.trip ?? ranges[ranges.length - 1].trip;
}

function extractDayFromRecipeKey(key: string) {
  const m = normalizeRecipeKey(key).match(/^d(\d)_(breakfast|lunch|dinner)$/);
  if (!m) return null;
  const day = Number(m[1]);
  return Number.isFinite(day) ? day : null;
}

function parseIngredientUsagesFromRecipes(recipes: Record<string, any>): IngredientUsage[] {
  const usages: IngredientUsage[] = [];

  for (const [rawKey, recipe] of Object.entries(recipes || {})) {
    const day = extractDayFromRecipeKey(rawKey);
    if (!day) continue;

    const ingredients = Array.isArray((recipe as any)?.ingredients) ? (recipe as any).ingredients : [];
    for (const item of ingredients) {
      const name = prettifyDisplayName(item?.name || "");
      const quantity = String(item?.quantity || "").trim();

      if (!name || !quantity) continue;

      const parsed = parseQuantityPrefix(quantity);
      if (!parsed) continue;

      const canonical = canonicalIngredientName(name);
      if (!canonical) continue;

      usages.push({
        day,
        canonical_name: canonical,
        display_name: name,
        amount: parsed.amount,
        unit: parsed.unit,
        category_key: inferCategoryKey(name),
      });
    }
  }

  return usages;
}

function parsePantryStock(haveRaw: string): PantryStock[] {
  const text = (haveRaw || "").trim();
  if (!text) return [];

  const parts = text
    .split(/\n|,|;/)
    .map((x) => x.trim())
    .filter(Boolean);

  const out: PantryStock[] = [];

  for (const part of parts) {
    const parsed = parseQuantityAnywhere(part);
    if (!parsed) continue;

    const canonical = canonicalIngredientName(parsed.name);
    if (!canonical) continue;

    out.push({
      canonical_name: canonical,
      display_name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit,
    });
  }

  return out;
}

function buildPriceHintMap(plan: any) {
  const map = new Map<string, PriceHint>();

  const shopping = Array.isArray(plan?.shopping) ? plan.shopping : [];
  for (const trip of shopping) {
    const items = Array.isArray(trip?.items) ? trip.items : [];
    for (const item of items) {
      const price = Number(item?.estimated_price_eur);
      if (!Number.isFinite(price) || price < 0) continue;

      const name = String(item?.name || "").trim();
      const quantity = String(item?.quantity || "").trim();

      const canonical = canonicalIngredientName(name);
      const parsed = parseQuantityPrefix(quantity);

      if (!canonical || !parsed || parsed.amount <= 0) continue;

      const key = `${canonical}|${parsed.unit}`;
      const unitPrice = price / parsed.amount;

      const prev = map.get(key);
      if (!prev) {
        map.set(key, { price_per_unit: unitPrice, samples: 1 });
      } else {
        const nextSamples = prev.samples + 1;
        map.set(key, {
          price_per_unit: (prev.price_per_unit * prev.samples + unitPrice) / nextSamples,
          samples: nextSamples,
        });
      }
    }
  }

  return map;
}

function fallbackUnitPrice(canonicalName: string, unit: string) {
  const category = inferCategoryKey(canonicalName);

  if (unit === "g") {
    if (category === "meat") return 0.015;
    if (category === "fish") return 0.02;
    if (category === "fruit") return 0.005;
    if (category === "veg") return 0.004;
    if (category === "dairy") return 0.007;
    return 0.006;
  }

  if (unit === "ml") {
    if (category === "dairy") return 0.0025;
    return 0.003;
  }

  if (unit === "ks") {
    if (category === "fruit") return 0.7;
    if (category === "veg") return 0.8;
    if (category === "dairy") return 0.35;
    return 1.2;
  }

  if (unit === "konzerva") return 2;
  if (unit === "balenie") return 2.5;
  if (unit === "bochnik") return 2.5;
  if (unit === "hlavka") return 1.8;
  if (unit === "strucik") return 0.12;
  if (unit === "platok") return 0.18;
  if (unit === "lyzica") return 0.15;

  return 1.5;
}

function estimateItemPrice(
  canonicalName: string,
  unit: string,
  amount: number,
  priceHints: Map<string, PriceHint>
) {
  const key = `${canonicalName}|${unit}`;
  const hint = priceHints.get(key);
  const perUnit = hint?.price_per_unit ?? fallbackUnitPrice(canonicalName, unit);
  return Number((perUnit * amount).toFixed(2));
}

function rebuildShoppingFromRecipes(plan: any, haveRaw: string, shoppingTrips: number) {
  const recipes = plan?.recipes && typeof plan.recipes === "object" ? plan.recipes : {};
  const usages = parseIngredientUsagesFromRecipes(recipes);

  if (!usages.length) {
    return normalizeShoppingCoversDays(plan, shoppingTrips);
  }

  const priceHints = buildPriceHintMap(plan);
  const pantry = parsePantryStock(haveRaw);

  const pantryMap = new Map<string, number>();
  for (const p of pantry) {
    const key = `${p.canonical_name}|${p.unit}`;
    pantryMap.set(key, (pantryMap.get(key) ?? 0) + p.amount);
  }

  const usagesSorted = usages
    .slice()
    .sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.display_name.localeCompare(b.display_name, "sk");
    });

  const remainingByTrip = new Map<
    string,
    { trip: number; covers_days: string; name: string; amount: number; unit: string; category_key: string }
  >();

  const ranges = getTripRanges(shoppingTrips);

  for (const usage of usagesSorted) {
    const stockKey = `${usage.canonical_name}|${usage.unit}`;
    const available = pantryMap.get(stockKey) ?? 0;
    let needed = usage.amount;

    if (available > 0) {
      const consumed = Math.min(available, needed);
      needed -= consumed;
      pantryMap.set(stockKey, available - consumed);
    }

    if (needed <= 0) continue;

    const trip = tripForDay(usage.day, shoppingTrips);
    const covers = ranges.find((r) => r.trip === trip)?.covers_days ?? "1-7";
    const tripKey = `${trip}|${usage.canonical_name}|${usage.unit}`;

    const prev = remainingByTrip.get(tripKey);
    if (!prev) {
      remainingByTrip.set(tripKey, {
        trip,
        covers_days: covers,
        name: usage.display_name,
        amount: needed,
        unit: usage.unit,
        category_key: usage.category_key,
      });
    } else {
      prev.amount += needed;
      remainingByTrip.set(tripKey, prev);
    }
  }

  const byTrip = new Map<number, any[]>();
  Array.from(remainingByTrip.values()).forEach((entry) => {
    const price = estimateItemPrice(
      canonicalIngredientName(entry.name),
      entry.unit,
      entry.amount,
      priceHints
    );

    const item = {
      name: entry.name,
      quantity: formatQuantity(entry.amount, entry.unit),
      estimated_price_eur: price,
      category_key: entry.category_key,
    };

    byTrip.set(entry.trip, [...(byTrip.get(entry.trip) ?? []), item]);
  });

  plan.shopping = ranges.map((range) => {
    const items = (byTrip.get(range.trip) ?? []).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), "sk")
    );

    return {
      trip: range.trip,
      covers_days: range.covers_days,
      estimated_cost_eur: 0,
      items,
    };
  });

  sumShoppingEstimates(plan);
  return plan;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    const forceOpenAiError = process.env.FORCE_OPENAI_ERROR === "1";

    if (forceOpenAiError) {
      return NextResponse.json(
        {
          error: {
            code: "OPENAI_UPSTREAM_ERROR",
            message: "Service temporarily unavailable",
          },
        },
        { status: 502 }
      );
    }

    if (!apiKey) {
      return NextResponse.json({ error: { code: "MISSING_OPENAI_KEY" } }, { status: 500 });
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const authClient = createSupabaseAdminClient();
    const { data: userRes, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const userId = userRes.user.id;
    const body = (await req.json()) as Body;

    const weekStart = (body.weekStart || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: { code: "INVALID_WEEK_START" } }, { status: 400 });
    }

    const peopleNum = parsePeople(body.people?.trim() || "");
    if (peopleNum == null) {
      return NextResponse.json({ error: { code: "INVALID_PEOPLE" } }, { status: 400 });
    }

    const budgetNum = parseBudget(body.budget?.trim() || "");
    if (budgetNum == null) {
      return NextResponse.json({ error: { code: "INVALID_BUDGET" } }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const sub = await requireActiveSubscription(supabase, userId);
    if (!sub.ok) return NextResponse.json(sub.payload, { status: sub.status });

    const planTier = sub.planTier as Plan;
    const limits = planLimits(planTier);

    const style = (body.style || "lacné").trim();
    if (!limits.allowed_styles.includes(style)) {
      return NextResponse.json(
        { error: { code: "STYLE_NOT_ALLOWED", style, plan: planTier } },
        { status: 403 }
      );
    }

    const { data: usageRow, error: usageErr } = await supabase
      .from("generation_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (usageErr) {
      return NextResponse.json(
        { error: { code: "USAGE_READ_FAILED", message: usageErr.message } },
        { status: 500 }
      );
    }

    const used = usageRow?.count ?? 0;
    if (used >= limits.weekly_limit) {
      return NextResponse.json(
        { error: { code: "WEEKLY_LIMIT_REACHED", used, limit: limits.weekly_limit, plan: planTier } },
        { status: 429 }
      );
    }

    const people = String(peopleNum);
    const budget = String(budgetNum);
    const intolerances = (body.intolerances || "").trim();
    const avoid = (body.avoid || "").trim();
    const have = (body.have || "").trim();
    const favorites = (body.favorites || "").trim();
    const specifications = (body.specifications || "").trim();

    const shoppingTrips = clampInt(body.shoppingTrips ?? 2, 1, 4, 2);
    const repeatDays = clampInt(body.repeatDays ?? 2, 1, 3, 2);

    const styleHint = styleHintFromValue(style);
    const dayNames = DAY_NAMES_SK;
    const datesBlock = dayNames
      .map((name, i) => `- day ${i + 1}: ${name}, date: ${addDaysISO(weekStart, i)}`)
      .join("\n");

    const variationHint = pickRandom(getPromptVariantsForStyle(style));

    const batchCookingBlock =
      repeatDays > 1
        ? `
BATCH COOKING (repeat_days_max = ${repeatDays}):
- Prefer meal plans that reduce cooking frequency by repeating some lunches and/or dinners across up to ${repeatDays} consecutive days.
- The main goal is to reduce the number of separate cooking sessions during the week.
- Prefer repeated lunches first; repeat dinners too when practical, but do not force every dinner to repeat if that would make the plan feel unnatural.
- Breakfasts do NOT need to follow batch cooking and can vary each day.
- If a meal is repeated across multiple consecutive days, use the same actual meal name in the "days" array for those days.
- Never use placeholder or reference labels such as "Rovnaký ako piatok obed", "rovnaký ako predchádzajúci deň", "same as previous day" and similar.
- Keep recipe keys for every day (d1_breakfast ... d7_dinner).
- Recipe ingredient quantities must stay realistic and consistent for the weekly totals when all recipe keys are summed together.
- Do NOT generate a plan where the user still has to cook a completely new lunch and a completely new dinner almost every day.
`
        : `
BATCH COOKING:
- repeat_days_max = 1, so do not intentionally repeat lunches or dinners across multiple days unless explicitly requested in specifications.
`;

    const caloriesBlock = `
CALORIES:
- Calories must be per person/serving.
- For each day include breakfast_kcal, lunch_kcal, dinner_kcal and total_kcal.
- In summary include weekly_total_kcal and avg_daily_kcal (for the whole household).
`;

    const schemaDaysCalories = `,
      "breakfast_kcal": number,
      "lunch_kcal": number,
      "dinner_kcal": number,
      "total_kcal": number`;

    const schemaSummaryCalories = `,
    "weekly_total_kcal": number,
    "avg_daily_kcal": number`;

    const prompt = `
Return ONLY valid JSON (no other text).
Všetko píš po slovensky.

Create a 7-day meal plan (breakfast/lunch/dinner).
Goal: create a practical, realistic weekly meal plan that respects the selected budget and style.

Parameters:
- people: ${people}
- weekly_budget_eur: ${budget}
- shopping_trips_per_week: ${shoppingTrips}
- repeat_days_max: ${repeatDays}

Hard restriction:
- forbidden_ingredients: ${intolerances || "none"}

Preferences:
- avoid: ${avoid || "none"}
- favorites: ${favorites || "none"}
- have_at_home: ${have || "none"}

Specific instructions:
- specifications: ${specifications || "none"}

How to treat specifications:
- Specifications are higher priority than general favorites.
- If specifications mention a concrete day, meal, repetition, or specific food, follow them as closely as possible.
- The text above under "specifications:" contains the ONLY active user instructions.
- Do NOT treat the examples or pattern descriptions below as active instructions.
- If a concrete repetition pattern is NOT explicitly written in specifications, do not infer that exact pattern from examples or from previous generations.
- If a specification conflicts with forbidden ingredients, forbidden ingredients always win.
- If a specification conflicts with "avoid", try to honor the specification but still keep the plan practical.
- If a specification is impossible within the budget or restrictions, do the closest realistic alternative and mention it briefly in the relevant day's "note".
- Pattern guide only (NOT active instructions by itself):
  - Pattern: "utorok a streda rovnaký obed" means lunch on day 2 and day 3 should be the same.
  - Pattern: "v piatok večer šunková pizza" means dinner on day 5 should match that request as closely as budget and restrictions allow.

Style:
- ${styleHint}

Jemná variácia pre túto generáciu:
- ${variationHint}

Week:
${datesBlock}

${batchCookingBlock}

BUDGET TARGET:
- Treat weekly_budget_eur as the target budget for the whole household, not only as a maximum cap.
- Aim for estimated_total_cost_eur around 90% to 100% of weekly_budget_eur.
- The final estimated_total_cost_eur should not exceed weekly_budget_eur by more than 5%.
- If needed, choose cheaper ingredients, simpler meals, or fewer premium items to stay within budget.
- Do not make the plan unnecessarily cheap if the budget allows more variety, better ingredients, fuller shopping, or better meal quality.
- Staying close to budget is more important than maximizing variety.
- The budget applies to the whole household for the full week, not per person.

Rules:
- Batch cooking is allowed, but do not over-optimize just for the lowest possible price.
- Reuse ingredients across days when practical.
- Split shopping into exactly ${shoppingTrips} trips.
- Provide realistic quantities.
- Every shopping trip must contain ONLY ingredients needed for the days covered by that trip.
- If an ingredient is needed both in early days and in later days, split it between both trips instead of putting everything into the first trip.
- For 2 trips per week, trip 1 must cover days 1-3 and trip 2 must cover days 4-7.
- For 3 trips per week, use practical split 1-2, 3-4, 5-7.
- For 4 trips per week, use practical split 1-2, 3-4, 5-6, 7.
- Do not place ingredients for day 4-7 into trip 1 when there are 2 trips.
${caloriesBlock}

IMPORTANT LOGIC FOR INGREDIENTS YOU ALREADY HAVE AT HOME:
- Treat have_at_home as real existing stock that should be consumed before adding new purchases.
- First determine the total weekly ingredient needs from all planned meals and recipes.
- Then subtract have_at_home from those weekly needs.
- Only the missing remainder may appear in the shopping list.
- Never buy the full weekly amount if part of it is already available at home.
- Example: if have_at_home contains "banány 4 ks" and the whole week uses 5 bananas in total, shopping must contain only 1 additional banana in total, not 2, not 3, not 5.
- Example: if have_at_home contains "vajcia 6 ks" and the week uses 4 eggs total, eggs should not appear in shopping at all.
- Apply this subtraction chronologically from day 1 forward.
- Existing stock should be consumed by the earliest days/meals first, and only the remaining unmet quantity should be assigned to the appropriate shopping trip.
- If an ingredient is first needed on later days and current stock still covers earlier use, do not buy extra pieces too early without reason.

IMPORTANT LOGIC FOR SHOPPING TRIPS:
- Shopping trips must be based on when ingredients are actually needed after subtracting home stock.
- Do not put all missing quantity into trip 1 by default.
- If part of an ingredient is needed in days 1-3 and another part only in days 4-7, split it between trips accordingly.
- For fresh and shorter-life items like bananas, berries, leafy greens, soft bread, fresh herbs and similar, strongly prefer buying the later-needed portion in the later trip instead of the first trip.
- Do not add safety reserve, extra spare pieces, or "just in case" quantities unless clearly necessary.
- Quantities should be realistic and economical, but not artificially inflated.

CONSISTENCY:
- Shopping quantities must be consistent with recipe ingredient totals across the whole week.
- The shopping list must not contradict the recipes.
- If recipes together require fewer pieces than the shopping list suggests after subtracting home stock, reduce the shopping list.
- Keep item naming consistent inside the same shopping list. Do not create duplicate item names that differ only by singular/plural, capitalization, or minor wording changes.
- Prefer one consistent naming form, for example use either "jablká" or "jablko", not both.
- Prefer one consistent naming form, for example use either "banány" or "banán", not both.

IMPORTANT FOR DAY MEAL NAMES:
- The values in days[].breakfast, days[].lunch and days[].dinner must always be actual meal titles.
- Never use reference-style labels such as "Rovnaký ako Piatok obed", "rovnaký ako predchádzajúci deň", "same as previous day", "opakované z dňa 3" and similar.
- If a meal repeats, write the actual repeated meal title again.

IMPORTANT FOR RECIPE INGREDIENTS:
- Every recipe ingredient quantity must start with a numeric value.
- Use practical units such as: g, kg, ml, l, ks, konzerva, balenie, bochník, hlávka, strúčik, plátok, lyžica.
- Avoid vague ingredient quantities like "trochu", "podľa chuti", "primerane" in the ingredients array.
- If the same ingredient appears multiple times during the week, keep its naming consistent across recipes.

SHOPPING:
- For each trip include estimated_cost_eur.
- For each shopping item include estimated_price_eur.
- trip.estimated_cost_eur must equal the sum of estimated_price_eur for all items in that trip.
- summary.estimated_total_cost_eur must equal the sum of all trip.estimated_cost_eur values.
- Item prices should be realistic retail estimates in EUR for the quantity listed.

RECIPES:
- Generate a recipe for EVERY meal: breakfast, lunch and dinner.
- Keys must be exactly: d{day}_{meal} where meal is breakfast|lunch|dinner.
- That means 21 recipes total.

JSON schema (follow exactly):
{
  "summary": {
    "people": number,
    "weekly_budget_eur": number,
    "shopping_trips_per_week": number,
    "repeat_days_max": number,
    "estimated_total_cost_eur": number,
    "savings_tips": string[]${schemaSummaryCalories}
  },
  "days": [
    {
      "day": 1,
      "day_name": string,
      "date": "YYYY-MM-DD",
      "breakfast": string,
      "lunch": string,
      "dinner": string,
      "note": string${schemaDaysCalories}
    }
  ],
  "shopping": [
    {
      "trip": 1,
      "covers_days": "1-3",
      "estimated_cost_eur": number,
      "items": [
        { "name": string, "quantity": string, "estimated_price_eur": number }
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

Counts:
- days must be exactly 7 (day 1..7)
- shopping must be exactly ${shoppingTrips} trips
- recipes must include ALL 21 keys (d1_breakfast..d7_dinner)
`;

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

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return NextResponse.json(
        { error: { code: "OPENAI_UPSTREAM_ERROR", status: r.status, detail: data } },
        { status: 502 }
      );
    }

    const text = extractText(data);
    const parsedRaw = safeParseJSON(text);

    if (!parsedRaw) {
      return NextResponse.json({ kind: "text", text }, { status: 200 });
    }

    const parsed = normalizePlan(parsedRaw);

    const recipes = parsed?.recipes && typeof parsed.recipes === "object" ? parsed.recipes : null;
    const missing = requiredRecipeKeys().filter((k) => !recipes?.[k]);

    if (missing.length) {
      return NextResponse.json({ error: { code: "MISSING_RECIPES", missing } }, { status: 500 });
    }

    if (!parsed.summary) parsed.summary = {};
    parsed.summary.people = coerceNumber(parsed.summary.people, peopleNum);
    parsed.summary.weekly_budget_eur = coerceNumber(parsed.summary.weekly_budget_eur, budgetNum);
    parsed.summary.shopping_trips_per_week = coerceNumber(parsed.summary.shopping_trips_per_week, shoppingTrips);
    parsed.summary.repeat_days_max = coerceNumber(parsed.summary.repeat_days_max, repeatDays);
    parsed.summary = ensurePerPersonCalories(parsed.summary);

    normalizeShoppingCoversDays(parsed, shoppingTrips);
    rebuildShoppingFromRecipes(parsed, have, shoppingTrips);
    sumShoppingEstimates(parsed);

    const { error: upErr } = await supabase.from("generation_usage").upsert(
      { user_id: userId, week_start: weekStart, count: used + 1 },
      { onConflict: "user_id,week_start" }
    );

    if (upErr) {
      return NextResponse.json(
        {
          kind: "json",
          plan: parsed,
          warning: { code: "USAGE_WRITE_FAILED", message: upErr.message },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ kind: "json", plan: parsed }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: e?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}