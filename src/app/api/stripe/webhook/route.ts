// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function toIsoFromUnix(unix?: number | null) {
  return unix ? new Date(unix * 1000).toISOString() : null;
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    // ===============================
    // CHECKOUT COMPLETED
    // ===============================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan as "basic" | "plus";

      const subscriptionId = (session.subscription as string | null) ?? null;
      const customerId = (session.customer as string | null) ?? null;

      if (!userId || !subscriptionId || !customerId) {
        return NextResponse.json({ received: true });
      }

      const sub = await stripe.subscriptions.retrieve(subscriptionId);

      const currentPeriodEnd = toIsoFromUnix((sub as any).current_period_end);
      const trialUntil = toIsoFromUnix((sub as any).trial_end); // ✅ Stripe trial_end

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: sub.status,
          current_period_end: currentPeriodEnd,
          trial_until: trialUntil, // ✅ DB trial_until
        },
        { onConflict: "user_id" }
      );
    }

    // ===============================
    // SUBSCRIPTION UPDATED
    // ===============================
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;

      const subscriptionId = sub.id;

      const currentPeriodEnd = toIsoFromUnix((sub as any).current_period_end);
      const trialUntil = toIsoFromUnix((sub as any).trial_end);

      await supabase
        .from("subscriptions")
        .update({
          status: sub.status,
          current_period_end: currentPeriodEnd,
          trial_until: trialUntil,
        })
        .eq("stripe_subscription_id", subscriptionId);
    }

    // ===============================
    // SUBSCRIPTION DELETED
    // ===============================
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const subscriptionId = sub.id;

      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          stripe_subscription_id: null,
          current_period_end: null,
        })
        .eq("stripe_subscription_id", subscriptionId);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}