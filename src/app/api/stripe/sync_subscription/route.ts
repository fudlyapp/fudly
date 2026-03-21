// src/app/api/stripe/sync_subscription/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = userRes.user;

    const { data: subRow, error: subErr } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    if (!subRow?.stripe_customer_id) {
      return NextResponse.json({ ok: false, reason: "missing_customer_id" });
    }

    const subs = await stripe.subscriptions.list({
      customer: subRow.stripe_customer_id,
      limit: 10,
      status: "all",
    });

    const sub =
      subs.data.find((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status)) ??
      subs.data[0];

    if (!sub) {
      return NextResponse.json({ ok: false, reason: "no_subscription_found" });
    }

    const priceId = sub.items.data[0]?.price?.id ?? null;

    const plan =
      priceId === process.env.STRIPE_PRICE_PLUS
        ? "plus"
        : "basic";

    const status = sub.status;
    const trialUntilUnix = sub.trial_end ?? null;
    const currentPeriodEndUnix = (sub as any).current_period_end ?? null;

    const trial_until = trialUntilUnix
      ? new Date(trialUntilUnix * 1000).toISOString()
      : null;

    const current_period_end = currentPeriodEndUnix
      ? new Date(currentPeriodEndUnix * 1000).toISOString()
      : null;

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

    const { error: upsertErr } = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan,
        status,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        trial_until,
        current_period_end,
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      plan,
      status,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}