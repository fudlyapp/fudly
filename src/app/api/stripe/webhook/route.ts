import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

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

      const subscriptionId = session.subscription as string | null;
      const customerId = session.customer as string | null;

      if (!userId || !subscriptionId || !customerId) {
        return NextResponse.json({ received: true });
      }

      const sub = await stripe.subscriptions.retrieve(subscriptionId);

      const currentPeriodEndUnix = (sub as any).current_period_end as number | undefined;
      const trialEndUnix = (sub as any).trial_end as number | undefined;

      const currentPeriodEnd = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null;

      const trialEnd = trialEndUnix
        ? new Date(trialEndUnix * 1000).toISOString()
        : null;

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: sub.status,
          current_period_end: currentPeriodEnd,
          trial_end: trialEnd,
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
      const customerId = sub.customer as string;

      const { data: row } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      if (!row?.user_id) return NextResponse.json({ received: true });

      const currentPeriodEndUnix = (sub as any).current_period_end as number | undefined;
      const trialEndUnix = (sub as any).trial_end as number | undefined;

      const currentPeriodEnd = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null;

      const trialEnd = trialEndUnix
        ? new Date(trialEndUnix * 1000).toISOString()
        : null;

      await supabase.from("subscriptions").update({
        status: sub.status,
        current_period_end: currentPeriodEnd,
        trial_end: trialEnd,
      }).eq("stripe_subscription_id", subscriptionId);
    }

    // ===============================
    // SUBSCRIPTION DELETED
    // ===============================
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const subscriptionId = sub.id;

      await supabase.from("subscriptions").update({
        status: "canceled",
      }).eq("stripe_subscription_id", subscriptionId);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}