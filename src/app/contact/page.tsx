//src/app/contact/page.tsx
"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";

export default function ContactPage() {
  const { t, lang } = useT() as any;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string>("");

  const requiredLabel = t?.common?.required ?? "Povinné";
  const title = t?.contact?.title ?? "Kontakt";
  const subtitle = t?.contact?.subtitle ?? "Napíš nám a ozveme sa čo najskôr.";
  const sendLabel = t?.contact?.send ?? "Odoslať";
  const sendingLabel = t?.contact?.sending ?? "Odosielam…";
  const success = t?.contact?.success ?? "✅ Správa bola odoslaná.";
  const fail = t?.contact?.fail ?? "❌ Nepodarilo sa odoslať správu.";

  function getLang(): string {
    return (lang as string) || (typeof document !== "undefined" ? document.documentElement.lang : "sk") || "sk";
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

      let j: any = null;
      try {
        j = await r.json();
      } catch {}

      if (!r.ok) throw new Error(j?.error ?? "Send failed");

      setInfo(success);
      setName("");
      setEmail("");
      setMessage("");
    } catch (e: any) {
      setInfo(`${fail}${e?.message ? ` (${e.message})` : ""}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl p-8 surface-same-as-nav surface-border">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 muted">{subtitle}</p>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <label className="block">
              <div className="text-sm mb-1 muted">
                {t?.contact?.name ?? "Meno"}
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-surface"
                placeholder={t?.contact?.name_placeholder ?? "Tvoje meno"}
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1 muted">
                {t?.contact?.email ?? "Email"}{" "}
                <span className="muted-2">({requiredLabel})</span>
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-surface"
                placeholder={t?.contact?.email_placeholder ?? "Tvoj e-mail"}
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1 muted">
                {t?.contact?.message ?? "Správa"}{" "}
                <span className="muted-2">({requiredLabel})</span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input-surface min-h-[140px]"
                placeholder={t?.contact?.message_placeholder ?? "Text…"}
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={sending || !email.trim() || !message.trim()}
              className="btn-primary"
            >
              {sending ? sendingLabel : sendLabel}
            </button>

            {info ? <div className="text-sm muted">{info}</div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}