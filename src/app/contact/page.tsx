// src/app/contact/page.tsx
"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";

export default function ContactPage() {
  const { t, lang: hookLang } = useT() as any;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string>("");

  function getLang(): "sk" | "en" | "uk" {
    const l =
      (hookLang as string | undefined) ||
      (typeof document !== "undefined" ? document.documentElement.lang : "") ||
      "sk";

    if (l === "en" || l === "uk" || l === "sk") return l;
    return "sk";
  }

  async function submit() {
    setInfo("");
    setSending(true);

    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, lang: getLang() }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Send failed");

      setInfo(t.contact.success);
      setName("");
      setEmail("");
      setMessage("");
    } catch (e: any) {
      setInfo(`${t.contact.fail} (${e?.message ?? "error"})`);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-gray-800 bg-zinc-950/60 p-8">
          <h1 className="text-3xl font-bold">{t.contact.title}</h1>
          <p className="mt-2 text-gray-300">{t.contact.subtitle}</p>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <label className="block">
              <div className="text-sm text-gray-300 mb-1">{t.contact.name}</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="Michal"
              />
            </label>

            <label className="block">
              <div className="text-sm text-gray-300 mb-1">
                {t.contact.email} <span className="text-gray-500">({t.common.required})</span>
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="michal@email.com"
              />
            </label>

            <label className="block">
              <div className="text-sm text-gray-300 mb-1">
                {t.contact.message} <span className="text-gray-500">({t.common.required})</span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[140px] w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="Napíš správu…"
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={sending || !email.trim() || !message.trim()}
              className="rounded-xl bg-white px-5 py-3 text-black font-semibold hover:bg-gray-200 disabled:opacity-40"
            >
              {sending ? t.common.loading : t.contact.send}
            </button>

            {info ? <div className="text-sm text-gray-200">{info}</div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}