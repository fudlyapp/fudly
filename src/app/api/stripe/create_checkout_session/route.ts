// src/app/api/stripe/create_checkout_session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type Body = { plan: "basic" | "plus" };

export async function POST(req: Request) {
  try {
    const { plan } = (await req.json()) as Body;

    if (plan !== "basic" && plan !== "plus") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = plan === "basic" ? process.env.STRIPE_PRICE_BASIC : process.env.STRIPE_PRICE_PLUS;
    if (!priceId) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_* env" }, { status: 500 });
    }

    // ✅ auth cez Bearer token z klienta
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createSupabaseAdminClient();

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userRes.user.id;
    const email = userRes.user.email ?? undefined;

    // ak už máme stripe_customer_id, použijeme ho
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    const customer = existingSub?.stripe_customer_id ?? undefined;

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const successUrl = `${origin}/pricing?success=1`;
    const cancelUrl = `${origin}/pricing?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      customer,
      customer_email: customer ? undefined : email,

      subscription_data: {
        trial_period_days: 14,
        metadata: { user_id: userId, plan },
      },

      metadata: { user_id: userId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}