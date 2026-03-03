import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type Body = { plan: "basic" | "plus" };

function siteUrlFromReq(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = userRes.user;

    const body = (await req.json().catch(() => null)) as Body | null;
    const plan = body?.plan;
    if (plan !== "basic" && plan !== "plus") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceBasic = process.env.STRIPE_PRICE_BASIC;
    const pricePlus = process.env.STRIPE_PRICE_PLUS;
    if (!priceBasic || !pricePlus) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_BASIC/STRIPE_PRICE_PLUS" }, { status: 500 });
    }

    const price = plan === "plus" ? pricePlus : priceBasic;

    // Nájdeme existujúce mapovanie
    const { data: subRow, error: subErr } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    // Ak už existuje subscription id, over v Stripe či je stále active-like
    const existingSubId = subRow?.stripe_subscription_id ?? null;
    if (existingSubId) {
      try {
        const existing = await stripe.subscriptions.retrieve(existingSubId);
        if (["active", "trialing", "past_due", "unpaid"].includes(existing.status)) {
          return NextResponse.json(
            { error: "Already has active subscription. Use portal.", stripe_subscription_id: existingSubId },
            { status: 409 }
          );
        }
      } catch {
        // staré ID - pokračuj
      }
    }

    // Customer
    let customerId = subRow?.stripe_customer_id ?? null;

    if (!customerId) {
      const created = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = created.id;

      // Ulož customer do DB hneď (portal bude fungovať aj pred webhookom)
      await supabase.from("subscriptions").upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          plan: "basic",
          status: "incomplete",
          current_period_end: null,
          trial_until: null,
        },
        { onConflict: "user_id" }
      );
    }

    const site = siteUrlFromReq(req);
    const successUrl = `${site}/pricing?success=1`;
    const cancelUrl = `${site}/pricing?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,

      // ✅ najspoľahlivejšie priradenie usera
      client_reference_id: user.id,

      // ✅ metadata na session
      metadata: {
        user_id: user.id,
        plan,
      },

      // ✅ metadata aj na subscription
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          user_id: user.id,
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}