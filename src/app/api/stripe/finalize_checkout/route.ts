// src/app/api/stripe/finalize_checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type Body = {
  session_id?: string;
};

function planFromPriceId(priceId: string | null): "basic" | "plus" {
  return priceId === process.env.STRIPE_PRICE_PLUS ? "plus" : "basic";
}

function normalizeStripeStatus(status: string): string {
  if (status === "unpaid") return "past_due";
  return status;
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const authClient = createSupabaseAdminClient();
    const { data: userRes, error: userErr } = await authClient.auth.getUser(token);

    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = userRes.user;
    const supabase = createSupabaseAdminClient();

    const body = (await req.json().catch(() => null)) as Body | null;
    const sessionId = body?.session_id?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (!session) {
      return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
    }

    const sessionUserId = session.client_reference_id ?? session.metadata?.user_id ?? null;
    if (!sessionUserId || sessionUserId !== user.id) {
      return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

    let subscriptionId: string | null = null;
    let status = "inactive";
    let plan: "basic" | "plus" = "basic";
    let trial_until: string | null = null;
    let current_period_end: string | null = null;

    const expandedSub = session.subscription;

    if (expandedSub && typeof expandedSub !== "string") {
      subscriptionId = expandedSub.id;
      status = normalizeStripeStatus(expandedSub.status);

      const priceId = expandedSub.items.data[0]?.price?.id ?? null;
      plan = planFromPriceId(priceId);

      const trialUntilUnix = expandedSub.trial_end ?? null;
      const currentPeriodEndUnix = (expandedSub as any).current_period_end ?? null;

      trial_until = trialUntilUnix
        ? new Date(trialUntilUnix * 1000).toISOString()
        : null;

      current_period_end = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null;
    } else if (typeof expandedSub === "string") {
      const sub = await stripe.subscriptions.retrieve(expandedSub);

      subscriptionId = sub.id;
      status = normalizeStripeStatus(sub.status);

      const priceId = sub.items.data[0]?.price?.id ?? null;
      plan = planFromPriceId(priceId);

      const trialUntilUnix = sub.trial_end ?? null;
      const currentPeriodEndUnix = (sub as any).current_period_end ?? null;

      trial_until = trialUntilUnix
        ? new Date(trialUntilUnix * 1000).toISOString()
        : null;

      current_period_end = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null;
    }

    const { error: upsertErr } = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan,
        status,
        trial_until,
        current_period_end,
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        plan,
        status,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}