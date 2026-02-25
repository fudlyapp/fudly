// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    // Ak ešte Stripe nemáš, webhook route nech “nepadá” (deploy/build ok)
    if (!stripe || !webhookSecret) {
      return NextResponse.json(
        { ok: false, error: "Stripe webhook nie je nakonfigurovaný." },
        { status: 200 }
      );
    }

    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      return NextResponse.json({ error: `Webhook signature verification failed: ${err?.message ?? "unknown"}` }, { status: 400 });
    }

    // ZATIAĽ len “ack”, DB update doplníme keď bude Stripe účet + produkty/price ID
    // event.type: customer.subscription.created/updated/deleted, checkout.session.completed, invoice.paid, invoice.payment_failed, ...
    return NextResponse.json({ received: true, type: event.type }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}