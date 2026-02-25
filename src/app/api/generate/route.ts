import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  weekStart?: string; // YYYY-MM-DD (pondelok)
  language?: string; // sk|en|uk

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

type Plan = "basic" | "plus";
type Status = "inactive" | "trialing" | "active" | "past_due" | "canceled";

function planLimits(plan: Plan) {
  if (plan === "plus") {
    return { weekly_limit: 5, calories_enabled: true, allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske", "fit", "tradicne", "exoticke"] };
  }
  return { weekly_limit: 3, calories_enabled: false, allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske"] };
}

function isActiveLike(status: Status, now: Date, currentPeriodEnd?: string | null, trialEnd?: string | null) {
  if (status === "active") {
    if (!currentPeriodEnd) return true;
    return new Date(currentPeriodEnd).getTime() > now.getTime();
  }
  if (status === "trialing") {
    if (!trialEnd) return false;
    return new Date(trialEnd).getTime() > now.getTime();
  }
  return false;
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

function addDaysISO(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const DAY_NAMES_SK = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];
const DAY_NAMES_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_UK = ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота", "Неділя"];

function styleHintFromValue(style: string, lang: string) {
  const sk = (s: string) => s;
  const en = (s: string) => s;
  const uk = (s: string) => s;

  const t = lang === "en" ? en : lang === "uk" ? uk : sk;

  switch (style) {
    case "rychle":
      return t(lang === "en" ? "Prefer very quick meals (max 20–30 min)." : lang === "uk" ? "Надавай перевагу дуже швидким стравам (макс 20–30 хв)." : "Uprednostni veľmi rýchle jedlá (max 20–30 min).");
    case "vyvazene":
      return t(lang === "en" ? "Prefer balanced meals (protein + veggies + sides), still budget-friendly." : lang === "uk" ? "Надавай перевагу збалансованим стравам (білок + овочі + гарнір), бюджетно." : "Uprednostni vyvážené jedlá (bielkoviny, zelenina, prílohy), stále rozumná cena.");
    case "vegetarianske":
      return t(lang === "en" ? "Vegetarian: no meat or fish (eggs and dairy OK)." : lang === "uk" ? "Вегетаріанське: без м’яса та риби (яйця й молочне можна)." : "Vegetariánske: bez mäsa a rýb (vajcia a mliečne OK).");
    case "tradicne":
      return t(lang === "en" ? "Traditional home-style meals." : lang === "uk" ? "Традиційні домашні страви." : "Tradičné: domáca poctivá strava (klasické slovenské/európske jedlá).");
    case "exoticke":
      return t(lang === "en" ? "Exotic inspirations (Asia/Mexico/fusion) using common store ingredients." : lang === "uk" ? "Екзотика (Азія/Мексика/fusion) зі звичайних продуктів." : "Exotické: inšpirácie Ázia/Mexiko/fusion, bežné suroviny z obchodu.");
    case "fit":
      return t(lang === "en" ? "Fit: more protein and veggies, less sugar." : lang === "uk" ? "Fit: більше білка й овочів, менше цукру." : "Fit: viac bielkovín, viac zeleniny, menej cukru, striedme porcie.");
    case "lacné":
    default:
      return t(lang === "en" ? "Prefer the cheapest meals from common ingredients." : lang === "uk" ? "Надавай перевагу найдешевшим стравам зі звичайних продуктів." : "Uprednostni čo najlacnejšie jedlá z bežných surovín.");
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Chýba OPENAI_API_KEY" }, { status: 500 });

    // auth (supabase access token)
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = userRes.user.id;

    const body = (await req.json()) as Body;

    const weekStart = (body.weekStart || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "Neplatný weekStart" }, { status: 400 });
    }

    const lang = (body.language || "sk").trim().toLowerCase();
    const language = lang === "en" ? "en" : lang === "uk" ? "uk" : "sk";

    // subscription check
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("plan,status,current_period_end,trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = (subRow?.plan as Plan) || "basic";
    const status = (subRow?.status as Status) || "inactive";
    const now = new Date();

    const limits = planLimits(plan);
    const canGenerate = isActiveLike(status, now, subRow?.current_period_end, subRow?.trial_end);

    if (!canGenerate) {
      return NextResponse.json(
        { error: { code: "SUBSCRIPTION_INACTIVE", plan, status } },
        { status: 402 }
      );
    }

    // style gate
    const style = (body.style || "lacné").trim();
    if (!limits.allowed_styles.includes(style)) {
      return NextResponse.json(
        { error: { code: "STYLE_NOT_ALLOWED", style, plan } },
        { status: 403 }
      );
    }

    // weekly usage gate
    const { data: usage } = await supabase
      .from("generation_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();

    const used = usage?.count ?? 0;
    if (used >= limits.weekly_limit) {
      return NextResponse.json(
        { error: { code: "WEEKLY_LIMIT_REACHED", used, limit: limits.weekly_limit, plan } },
        { status: 429 }
      );
    }

    // increment usage (atomic-ish cez upsert)
    await supabase.from("generation_usage").upsert(
      { user_id: userId, week_start: weekStart, count: used + 1 },
      { onConflict: "user_id,week_start" }
    );

    // input fields
    const people = body.people?.trim() || "1";
    const budget = body.budget?.trim() || "0";
    const intolerances = (body.intolerances || "").trim();
    const avoid = (body.avoid || "").trim();
    const have = (body.have || "").trim();
    const favorites = (body.favorites || "").trim();
    const shoppingTrips = Math.min(4, Math.max(1, Number(body.shoppingTrips || 2)));
    const repeatDays = Math.min(3, Math.max(1, Number(body.repeatDays || 2)));

    const styleHint = styleHintFromValue(style, language);

    const dayNames = language === "en" ? DAY_NAMES_EN : language === "uk" ? DAY_NAMES_UK : DAY_NAMES_SK;

    const datesBlock = dayNames.map((name, i) => `- day ${i + 1}: ${name}, date: ${addDaysISO(weekStart, i)}`).join("\n");

    const languageRule =
      language === "en" ? "Write everything in English."
      : language === "uk" ? "Пиши все українською."
      : "Všetko píš po slovensky.";

    const recipesRule =
      language === "en"
        ? "Generate a recipe for every meal (breakfast, lunch, dinner)."
        : language === "uk"
        ? "Згенеруй рецепт для кожного прийому їжі (сніданок, обід, вечеря)."
        : "Vygeneruj recept pre každé jedlo (raňajky, obed, večera).";

    const caloriesRule =
      language === "en"
        ? "Calories are per person/serving. Provide daily totals."
        : language === "uk"
        ? "Калорії вказуй на 1 порцію/особу. Дай підсумок за день."
        : "Kalórie sú per person/porcia. Daj denné súčty.";

    const prompt = `
Return ONLY valid JSON (no other text).
${languageRule}

Create a 7-day meal plan (breakfast/lunch/dinner).
Goal: save time and money.

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

Style:
- ${styleHint}

Week:
${datesBlock}

Rules:
- Batch cooking, reuse ingredients across days.
- Split shopping into exactly ${shoppingTrips} trips.
- Provide realistic quantities.

CALORIES:
- For each day include breakfast_kcal, lunch_kcal, dinner_kcal and total_kcal.
${caloriesRule}

SHOPPING:
- For each trip include estimated_cost_eur.

RECIPES:
- ${recipesRule}
- Keys must be: d{day}_{meal} where meal is breakfast|lunch|dinner.
- That means 21 recipes total (7 days * 3 meals).

JSON schema (follow exactly):
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

    const data = await r.json();

    if (!r.ok) {
      return NextResponse.json({ error: data }, { status: 500 });
    }

    const text = extractText(data);
    const parsed = safeParseJSON(text);

    if (!parsed) return NextResponse.json({ kind: "text", text }, { status: 200 });

    // safety: verify recipes coverage (21)
    const recipes = parsed?.recipes && typeof parsed.recipes === "object" ? parsed.recipes : null;
    const requiredMeals = ["breakfast", "lunch", "dinner"];
    const missing: string[] = [];

    for (let d = 1; d <= 7; d++) {
      for (const m of requiredMeals) {
        const key = `d${d}_${m}`;
        if (!recipes?.[key]) missing.push(key);
      }
    }

    if (missing.length) {
      return NextResponse.json(
        { error: { code: "MISSING_RECIPES", missing } },
        { status: 500 }
      );
    }

    return NextResponse.json({ kind: "json", plan: parsed }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}