// src/app/api/generate/route.ts
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
  style?: string;
  shoppingTrips?: string;
  repeatDays?: string;
};

type Plan = "basic" | "plus";
type Status = "inactive" | "trialing" | "active" | "past_due" | "canceled";

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

const DAY_NAMES_SK = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];

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

    const shoppingTrips = clampInt(body.shoppingTrips ?? 2, 1, 4, 2);
    const repeatDays = clampInt(body.repeatDays ?? 2, 1, 3, 2);

    const styleHint = styleHintFromValue(style);
    const dayNames = DAY_NAMES_SK;
    const datesBlock = dayNames
      .map((name, i) => `- day ${i + 1}: ${name}, date: ${addDaysISO(weekStart, i)}`)
      .join("\n");

    const variationHint = pickRandom(getPromptVariantsForStyle(style));

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

Style:
- ${styleHint}

Jemná variácia pre túto generáciu:
- ${variationHint}

Week:
${datesBlock}

BUDGET TARGET:
- Treat weekly_budget_eur as the target budget for the whole household, not only as a maximum cap.
- Aim for estimated_total_cost_eur around 85% to 100% of weekly_budget_eur.
- Do not make the plan unnecessarily cheap if the budget allows more variety, better ingredients, fuller shopping, or better meal quality.
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

SHOPPING:
- For each trip include estimated_cost_eur.
- For each shopping item include estimated_price_eur.
- trip.estimated_cost_eur must equal the sum of estimated_price_eur for all items in that trip.
- summary.estimated_total_cost_eur must equal the sum of all trip.estimated_cost_eur values.
- Item prices should be realistic retail estimates in EUR for the quantity listed.
- Keep item naming consistent inside the same shopping list. Do not create duplicate item names that differ only by singular/plural, capitalization, or minor wording changes.
- Prefer one consistent naming form, for example use either "jablká" or "jablko", not both.
- Prefer one consistent naming form, for example use either "banány" or "banán", not both.

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