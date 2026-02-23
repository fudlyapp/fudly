"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ShoppingTrip = {
  trip: number;
  covers_days: string;
  estimated_cost_eur?: number;
  items: Array<{ name: string; quantity: string }>;
};

type PlanJSON = {
  shopping?: ShoppingTrip[];
};

function formatDateSK(iso?: string) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  return `${dd}.${mm}.${y}`;
}

function addDaysISO(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ExportShoppingPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const params = useParams<{ week_start: string }>();
  const weekStart = (params?.week_start || "").toString();

  const [loading, setLoading] = useState(true);
  const [shopping, setShopping] = useState<ShoppingTrip[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setError("");
      setLoading(true);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;

      if (!user) {
        setError("Nie si prihlásený.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan, week_start")
        .eq("user_id", user.id)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const plan = (data as any)?.plan as PlanJSON | undefined;
      setShopping((plan?.shopping as any) ?? []);
      setLoading(false);

      // auto-print po načítaní
      setTimeout(() => window.print(), 250);
    })();
  }, [supabase, weekStart]);

  const weekEnd = /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? addDaysISO(weekStart, 6) : "";

  return (
    <main className="min-h-screen bg-white text-black p-6 print:p-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 print:mb-2">
          <div className="text-sm text-gray-600">Fudly – Export nákupov</div>
          <h1 className="text-2xl font-bold">Nákupný zoznam</h1>
          <div className="text-sm text-gray-700">
            Týždeň: {formatDateSK(weekStart)} – {formatDateSK(weekEnd)}
          </div>
        </div>

        {loading ? <div>Načítavam…</div> : null}
        {error ? <div className="text-red-600">Chyba: {error}</div> : null}

        {!loading && !error && !shopping.length ? <div>Žiadne nákupy.</div> : null}

        <div className="space-y-4">
          {shopping.map((t) => (
            <section key={t.trip} className="border border-gray-300 rounded-lg p-4 print:border-gray-400">
              <div className="flex items-baseline justify-between gap-4">
                <div className="font-semibold">Nákup {t.trip}</div>
                <div className="text-sm text-gray-700">
                  dni: {t.covers_days} • odhad: {t.estimated_cost_eur ?? "—"} €
                </div>
              </div>

              <ul className="mt-3 space-y-1">
                {(t.items || []).map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-4">
                    <span>{it.name}</span>
                    <span className="text-gray-700">{it.quantity}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-6 text-xs text-gray-600 print:hidden">
          Tip: V prehliadači daj “Uložiť ako PDF”.
        </div>
      </div>
    </main>
  );
}