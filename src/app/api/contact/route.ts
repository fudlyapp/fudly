// src/app/api/contact/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

type Lang = "sk" | "en" | "uk";

export async function POST(req: Request) {
  try {
    const { name, email, message, lang } = (await req.json()) as {
      name: string;
      email: string;
      message: string;
      lang?: Lang;
    };

    if (!email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const to = process.env.CONTACT_TO_EMAIL;
    const from = process.env.CONTACT_FROM_EMAIL;
    const replyTo = process.env.CONTACT_REPLYTO_EMAIL || to;

    if (!to || !from) {
      return NextResponse.json({ error: "Missing CONTACT_* env" }, { status: 500 });
    }

    const safeName = escapeHtml(name || "");
    const safeEmail = escapeHtml(email || "");
    const safeMessage = escapeHtml(message || "");

    // 1) email tebe (admin)
    const subjectAdmin = `Fudly kontakt: ${name ? name : "bez mena"} (${email})`;

    const htmlAdmin = `
      <div style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial;">
        <h2>Fudly – kontaktný formulár</h2>
        <p><strong>Meno:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Správa:</strong></p>
        <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px;">${safeMessage}</pre>
      </div>
    `;

    await resend.emails.send({
      from,
      to,
      subject: subjectAdmin,
      html: htmlAdmin,
      replyTo: email, // aby si vedel rovno odpovedať userovi
    });

    // 2) autoreply userovi
    const L: Lang = lang === "en" || lang === "uk" || lang === "sk" ? lang : "sk";
    const auto = autoReplyCopy(L);

    const htmlAuto = `
      <div style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial;">
        <h2 style="margin:0 0 12px 0;">${escapeHtml(auto.title)}</h2>
        <p style="margin:0 0 10px 0;">${escapeHtml(auto.hello(name))}</p>
        <p style="margin:0 0 10px 0;">${escapeHtml(auto.received)}</p>
        <div style="margin:14px 0 14px 0;padding:12px;border-radius:8px;background:#f6f6f6;">
          <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(auto.yourMessage)}</div>
          <pre style="white-space:pre-wrap;margin:0;">${safeMessage}</pre>
        </div>
        <p style="margin:0 0 8px 0;">${escapeHtml(auto.replyTime)}</p>
        <p style="margin:0;">${escapeHtml(auto.signature)}</p>
      </div>
    `;

    await resend.emails.send({
      from,
      to: email,
      subject: auto.subject,
      html: htmlAuto,
      replyTo: replyTo ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

function autoReplyCopy(lang: "sk" | "en" | "uk") {
  if (lang === "en") {
    return {
      subject: "We received your message — Fudly",
      title: "Thanks for reaching out",
      hello: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
      received: "We’ve received your message and will get back to you as soon as possible.",
      yourMessage: "Your message",
      replyTime: "Typical reply time: within 1–2 business days.",
      signature: "— Fudly team",
    };
  }
  if (lang === "uk") {
    return {
      subject: "Ми отримали ваше повідомлення — Fudly",
      title: "Дякуємо за звернення",
      hello: (name?: string) => (name ? `Привіт, ${name}!` : "Привіт!"),
      received: "Ми отримали ваше повідомлення та відповімо якнайшвидше.",
      yourMessage: "Ваше повідомлення",
      replyTime: "Зазвичай відповідаємо протягом 1–2 робочих днів.",
      signature: "— команда Fudly",
    };
  }
  return {
    subject: "Prijali sme tvoju správu — Fudly",
    title: "Ďakujeme za kontakt",
    hello: (name?: string) => (name ? `Ahoj ${name},` : "Ahoj,"),
    received: "Tvoju správu sme prijali a ozveme sa čo najskôr.",
    yourMessage: "Tvoja správa",
    replyTime: "Bežná doba odpovede: do 1–2 pracovných dní.",
    signature: "— tím Fudly",
  };
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}