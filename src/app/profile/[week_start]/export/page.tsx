// src/app/profile/[week_start]/export/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function buildNotesChecklistText(weekStart: string, weekEnd: string, shopping: ShoppingTrip[]) {
  const lines: string[] = [];
  lines.push(`Fudly – Nákupný zoznam`);
  lines.push(`Týždeň: ${formatDateSK(weekStart)} – ${formatDateSK(weekEnd)}`);
  lines.push(``);
  lines.push(`Tip: V Poznámkach označ tento text ako „Kontrolný zoznam“ a budeš odškrtávať položky.`);
  lines.push(``);

  for (const t of shopping || []) {
    lines.push(`Nákup ${t.trip} (${t.covers_days})`);
    lines.push(`Odhad: ${t.estimated_cost_eur ?? "—"} €`);
    lines.push(``);

    const items = Array.isArray(t.items) ? t.items : [];
    for (const it of items) {
      const name = (it?.name ?? "").trim();
      const qty = (it?.quantity ?? "").trim();
      const suffix = qty ? ` — ${qty}` : "";
      // Markdown-like checkbox; Notes to často pekne prekonvertuje na checklist po "Kontrolný zoznam"
      lines.push(`- [ ] ${name}${suffix}`);
    }

    lines.push(``);
  }

  return lines.join("\n");
}

async function copyToClipboard(text: string) {
  // Clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

export default function ExportShoppingPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const params = useParams<{ week_start: string }>();
  const weekStart = (params?.week_start || "").toString();

  const [loading, setLoading] = useState(true);
  const [shopping, setShopping] = useState<ShoppingTrip[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const weekEnd = /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? addDaysISO(weekStart, 6) : "";

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  }, []);

  const notesText = useMemo(() => buildNotesChecklistText(weekStart, weekEnd, shopping), [weekStart, weekEnd, shopping]);

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

      // PC: auto-print (nechávame ako doteraz)
      setTimeout(() => {
        try {
          const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
          if (!mobile) window.print();
        } catch {
          // ignore
        }
      }, 250);
    })();
  }, [supabase, weekStart]);

  async function shareToNotes() {
    try {
      if (typeof navigator === "undefined") return;

      const title = `Fudly nákup – ${formatDateSK(weekStart)}–${formatDateSK(weekEnd)}`;

      // Web Share API (iOS/Android)
      const anyNav = navigator as any;
      if (anyNav.share) {
        await anyNav.share({
          title,
          text: notesText,
        });
        return;
      }

      // Fallback: copy
      await copyToClipboard(notesText);
      setToast("Skopírované. Vlož do Poznámok.");
      setTimeout(() => setToast(""), 2000);
    } catch (e) {
      // fallback copy
      try {
        await copyToClipboard(notesText);
        setToast("Skopírované. Vlož do Poznámok.");
        setTimeout(() => setToast(""), 2000);
      } catch {
        setToast("Nepodarilo sa zdieľať ani skopírovať.");
        setTimeout(() => setToast(""), 2000);
      }
    }
  }

  async function onCopy() {
    try {
      await copyToClipboard(notesText);
      setToast("Skopírované do schránky.");
      setTimeout(() => setToast(""), 2000);
    } catch {
      setToast("Kopírovanie zlyhalo.");
      setTimeout(() => setToast(""), 2000);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-6 page-invert-bg overflow-x-hidden print:bg-white print:text-black print:p-0">
      {/* Print-friendly CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-wrap { max-width: 100% !important; padding: 0 !important; }
          .print-card { border: 0 !important; padding: 0 !important; border-radius: 0 !important; }
          .print-title { margin-bottom: 8px !important; }
          .print-list li { break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-2xl print-wrap">
        {/* Top bar (hide on print) */}
        <div className="no-print mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Link
            href={`/profile/${weekStart}`}
            className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition w-full sm:w-auto text-center"
          >
            Späť na detail
          </Link>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Mobile: share/copy */}
            {isMobile ? (
              <>
                <button type="button" onClick={shareToNotes} className="btn-primary px-4 py-2 text-sm w-full sm:w-auto">
                  Zdieľať do Poznámok
                </button>
                <button
                  type="button"
                  onClick={onCopy}
                  className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition w-full sm:w-auto"
                >
                  Kopírovať
                </button>
              </>
            ) : (
              // PC: nič nemeníme – iba tlač
              <button type="button" onClick={() => window.print()} className="btn-primary px-4 py-2 text-sm w-full sm:w-auto">
                Tlačiť
              </button>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="mb-4 print-title">
          <div className="text-xs muted-2">Fudly – Export nákupov</div>
          <h1 className="text-2xl font-bold">Nákupný zoznam</h1>
          <div className="text-sm muted">
            Týždeň: {formatDateSK(weekStart)} – {formatDateSK(weekEnd)}
          </div>
        </div>

        {toast ? (
          <div className="no-print mb-3 rounded-xl surface-same-as-nav surface-border px-3 py-2 text-sm muted">
            {toast}
          </div>
        ) : null}

        {loading ? <div className="text-sm muted-2">Načítavam…</div> : null}
        {error ? <div className="text-sm text-red-500">{error}</div> : null}

        {!loading && !error ? (
          <div className="space-y-4">
            {shopping.length === 0 ? (
              <div className="rounded-2xl p-4 surface-same-as-nav surface-border print-card">
                <div className="text-sm muted">Žiadne nákupy v tomto pláne.</div>
              </div>
            ) : (
              shopping.map((t) => (
                <div key={t.trip} className="rounded-2xl p-4 surface-same-as-nav surface-border print-card">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-semibold">
                      Nákup {t.trip} <span className="text-xs font-normal muted-2">({t.covers_days})</span>
                    </div>
                    <div className="text-xs muted-2">
                      Odhad: <span className="font-semibold">{t.estimated_cost_eur ?? "—"} €</span>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-sm print-list">
                    {(t.items ?? []).map((it, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">{it.name}</span>
                        <span className="muted-2 shrink-0">{it.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        ) : null}

        {/* Mobile-only preview of notes format (optional, small) */}
        {isMobile && !loading && !error ? (
          <div className="no-print mt-6 rounded-2xl p-4 surface-same-as-nav surface-border">
            <div className="text-sm font-semibold">Text pre Poznámky (preview)</div>
            <div className="mt-1 text-xs muted-2">
              Po zdieľaní/kopírovaní si v Poznámkach zvoľ „Kontrolný zoznam“ a budeš odškrtávať.
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-[11px] leading-tight muted">{notesText}</pre>
          </div>
        ) : null}
      </div>
    </main>
  );
}