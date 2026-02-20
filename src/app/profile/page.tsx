"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type MealPlanRow = {
  week_start: string; // YYYY-MM-DD
  is_edited: boolean;
  edited_at: string | null;
};

function formatMonthSK(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const months = [
    "Január","Február","Marec","Apríl","Máj","Jún",
    "Júl","August","September","Október","November","December",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateSK(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default function ProfilePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [items, setItems] = useState<MealPlanRow[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");

      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      setUserEmail(user?.email ?? null);

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("week_start,is_edited,edited_at")
        .order("week_start", { ascending: false });

      if (error) {
        setErr(error.message);
        setItems([]);
      } else {
        setItems((data as any) ?? []);
      }

      setLoading(false);
    })();
  }, [supabase]);

  // grupovanie po mesiacoch
  const grouped = useMemo(() => {
    const map = new Map<string, MealPlanRow[]>();
    for (const it of items) {
      const key = formatMonthSK(it.week_start);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Profil</h1>
            <p className="mt-2 text-gray-300">Tvoje uložené jedálničky podľa týždňov.</p>
          </div>

          <div className="text-right space-y-2">
            {userEmail ? (
              <>
                <div className="text-sm text-gray-300">
                  Prihlásený ako <span className="text-white font-semibold">{userEmail}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => (window.location.href = "/generate")}
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Generátor
                  </button>
                  <button
                    onClick={logout}
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Odhlásiť sa
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </header>

        {loading ? (
          <div className="text-gray-400">Načítavam…</div>
        ) : err ? (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-200">
            Chyba: {err}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6 text-gray-300">
            Zatiaľ nemáš uložený žiadny jedálniček. Choď do <b>Generátora</b> a ulož si týždeň.
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([month, arr]) => (
              <section key={month} className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-semibold">{month}</h2>
                <div className="mt-4 overflow-hidden rounded-xl border border-gray-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black text-gray-300">
                      <tr>
                        <th className="px-3 py-2">Týždeň od</th>
                        <th className="px-3 py-2">Stav</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {arr.map((it) => (
                        <tr key={it.week_start} className="border-t border-gray-800">
                          <td className="px-3 py-2 text-gray-200 font-semibold">
                            {formatDateSK(it.week_start)}
                          </td>
                          <td className="px-3 py-2 text-gray-300">
                            {it.is_edited ? (
                              <span className="text-yellow-300">Upravené</span>
                            ) : (
                              <span className="text-green-300">AI plán</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => (window.location.href = `/plans/${it.week_start}`)}
                              className="rounded-xl bg-white px-4 py-2 text-black font-semibold hover:bg-gray-200"
                            >
                              Otvoriť / upraviť
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}