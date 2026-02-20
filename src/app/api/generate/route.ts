import { NextResponse } from "next/server";

type Body = {
  people: string;
  budget: string;

  intolerances?: string;
  avoid?: string;
  have?: string;
  favorites?: string;

  style?: string;
  shoppingTrips?: string;
  repeatDays?: string;

  weekStart?: string; // YYYY-MM-DD (pondelok)
  language?: string;  // "sk"
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

function isISODate(s?: string) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDaysISO(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chýba OPENAI_API_KEY v env" }, { status: 500 });
    }

    const people = body.people?.trim() || "1";
    const budget = body.budget?.trim() || "0";

    const intolerances = (body.intolerances || "").trim();
    const avoid = (body.avoid || "").trim();
    const have = (body.have || "").trim();
    const favorites = (body.favorites || "").trim();

    const style = (body.style || "lacné").trim();
    const shoppingTrips = Math.min(4, Math.max(1, Number(body.shoppingTrips || 2)));
    const repeatDays = Math.min(3, Math.max(1, Number(body.repeatDays || 2)));

    const weekStart = isISODate(body.weekStart) ? body.weekStart! : addDaysISO(addDaysISO(new Date().toISOString().slice(0, 10), 0), 0);

    const styleHint =
      style === "rychle"
        ? "Uprednostni veľmi rýchle jedlá (max 20–30 min)."
        : style === "vyvazene"
        ? "Uprednostni vyvážené jedlá (bielkoviny, zelenina, prílohy), stále však lacné."
        : "Uprednostni čo najlacnejšie jedlá z bežných surovín.";

    const d1 = weekStart;
    const d2 = addDaysISO(weekStart, 1);
    const d3 = addDaysISO(weekStart, 2);
    const d4 = addDaysISO(weekStart, 3);
    const d5 = addDaysISO(weekStart, 4);
    const d6 = addDaysISO(weekStart, 5);
    const d7 = addDaysISO(weekStart, 6);

    const prompt = `
Si plánovač jedálničkov pre Slovensko.

Vráť IBA validný JSON (žiadny iný text). Všetko píš po slovensky.

Vytvor 7-dňový jedálniček (raňajky/obed/večera) pre domácnosť.
Cieľ: šetriť čas aj peniaze.

Parametre:
- people: ${people}
- weekly_budget_eur: ${budget}
- shopping_trips_per_week: ${shoppingTrips}
- repeat_days_max: ${repeatDays}
- week_start_monday: ${weekStart}

TVRDÉ obmedzenie:
- forbidden_ingredients (nesmú byť použité): ${intolerances || "none"}

Preferencie:
- avoid: ${avoid || "none"}
- favorites: ${favorites || "none"}
- have_at_home: ${have || "none"}

Štýl:
- ${styleHint}

Pravidlá:
- Nadväzuj jedlá (batch cooking), aby človek nevaril 3× denne každý deň.
- Opakuj suroviny naprieč dňami (minimalizuj odpad).
- Rozdeľ nákup do ${shoppingTrips} nákupov podľa dní.
- Jedlá a názvy ingrediencií píš po slovensky.
- Daj realistické množstvá.

Použi tieto dátumy a názvy dní:
1 = Pondelok, date="${d1}"
2 = Utorok,   date="${d2}"
3 = Streda,   date="${d3}"
4 = Štvrtok,  date="${d4}"
5 = Piatok,   date="${d5}"
6 = Sobota,   date="${d6}"
7 = Nedeľa,   date="${d7}"

JSON schéma (dodrž presne):
{
  "summary": {
    "people": number,
    "weekly_budget_eur": number,
    "shopping_trips_per_week": number,
    "repeat_days_max": number,
    "estimated_total_cost_eur": number,
    "savings_tips": string[]
  },
  "days": [
    {
      "day": 1,
      "day_name": "Pondelok",
      "date": "YYYY-MM-DD",
      "breakfast": string,
      "lunch": string,
      "dinner": string,
      "note": string
    }
  ],
  "shopping": [
    {
      "trip": 1,
      "covers_days": "1-3",
      "items": [
        { "name": string, "quantity": string }
      ]
    }
  ]
}

Počet položiek:
- days musí mať presne 7 dní (day 1..7)
- shopping musí mať presne ${shoppingTrips} nákupov (trip 1..${shoppingTrips})
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

    if (!parsed) {
      return NextResponse.json({ kind: "text", text }, { status: 200 });
    }

    return NextResponse.json({ kind: "json", plan: parsed }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}