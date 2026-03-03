// src/app/api/stripe/create_checkout_session/route.ts
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

    // 1) Nájdeme existujúce mapovanie v DB (ak existuje)
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,status")
      .eq("user_id", user.id)
      .maybeSingle();

    // Ak už má aktívne/trial predplatné, vráť 409 (to je to, čo teraz vidíš)
    const existingSubId = subRow?.stripe_subscription_id ?? null;
    if (existingSubId) {
      // niekedy máš stale row ale v Stripe je zrušené – overíme v Stripe
      try {
        const existing = await stripe.subscriptions.retrieve(existingSubId);
        if (["active", "trialing", "past_due", "unpaid"].includes(existing.status)) {
          return NextResponse.json(
            { error: "Already has active subscription. Use portal.", stripe_subscription_id: existingSubId },
            { status: 409 }
          );
        }
      } catch {
        // ak retrieve zlyhá, pokračujeme – môže byť staré ID
      }
    }

    // 2) Customer: ak existuje v DB, použi ho. Inak vytvor.
    let customerId = subRow?.stripe_customer_id ?? null;

    if (!customerId) {
      const created = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = created.id;

      // uložíme aspoň customer_id do DB, aby portal fungoval hneď po checkout
      await supabase.from("subscriptions").upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          plan: "basic", // dočasne, reálny plán nastaví webhook podľa price
          status: "incomplete",
          current_period_end: null,
          trial_until: null,
          stripe_subscription_id: null,
        },
        { onConflict: "user_id" }
      );
    }

    const site = siteUrlFromReq(req);
    const successUrl = `${site}/pricing?success=1`;
    const cancelUrl = `${site}/pricing?canceled=1`;

    // 3) Checkout session – a TU je fix: metadata pre webhook + subscription_data.metadata
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,

      // ✅ toto musí byť, inak webhook nevie user_id
      metadata: {
        user_id: user.id,
        plan,
      },

      // ✅ toto je extra istota: user_id aj na subscription
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