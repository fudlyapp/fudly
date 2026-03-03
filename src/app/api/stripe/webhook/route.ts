import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function toIsoFromUnix(unix?: number | null) {
  return unix ? new Date(unix * 1000).toISOString() : null;
}

function inferPlanFromSubscription(sub: Stripe.Subscription): "basic" | "plus" | null {
  const priceIdBasic = process.env.STRIPE_PRICE_BASIC;
  const priceIdPlus = process.env.STRIPE_PRICE_PLUS;
  if (!priceIdBasic || !priceIdPlus) return null;

  const first = sub.items?.data?.[0];
  const priceId = first?.price?.id ?? null;
  if (!priceId) return null;

  if (priceId === priceIdPlus) return "plus";
  if (priceId === priceIdBasic) return "basic";
  return null;
}

async function resolveUserIdFromStripe(
  customerId: string | null,
  subscriptionId: string | null,
  fallbackUserId: string | null
) {
  // 1) fallback z eventu (session.client_reference_id / session.metadata)
  let userId = fallbackUserId;

  // 2) subscription metadata
  if (!userId && subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (sub?.metadata?.user_id) userId = sub.metadata.user_id;
    } catch {}
  }

  // 3) customer metadata
  if (!userId && customerId) {
    try {
      const cust = await stripe.customers.retrieve(customerId);
      if (!("deleted" in cust) && cust?.metadata?.user_id) userId = cust.metadata.user_id;
    } catch {}
  }

  return userId;
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    // ---------- checkout.session.completed ----------
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const subscriptionId = (session.subscription as string | null) ?? null;
      const customerId = (session.customer as string | null) ?? null;

      const fallbackUserId =
        (session.metadata?.user_id as string | undefined) ??
        (session.client_reference_id as string | undefined) ??
        null;

      const userId = await resolveUserIdFromStripe(customerId, subscriptionId, fallbackUserId);

      if (!userId || !subscriptionId || !customerId) {
        return NextResponse.json({
          received: true,
          note: "missing userId/subscriptionId/customerId",
          userId,
          subscriptionId,
          customerId,
        });
      }

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const plan =
        (sub.metadata?.plan as "basic" | "plus" | undefined) ??
        inferPlanFromSubscription(sub) ??
        "basic";

      const currentPeriodEnd = toIsoFromUnix((sub as any).current_period_end);
      const trialUntil = toIsoFromUnix((sub as any).trial_end);

      const { error } = await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: sub.status,
          current_period_end: currentPeriodEnd,
          trial_until: trialUntil,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        return NextResponse.json({ received: true, note: "db upsert failed", db_error: error.message });
      }

      return NextResponse.json({ received: true });
    }

    // ---------- customer.subscription.* ----------
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const subscriptionId = sub.id;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

      const fallbackUserId = (sub.metadata?.user_id as string | undefined) ?? null;
      const userId = await resolveUserIdFromStripe(customerId, subscriptionId, fallbackUserId);

      const currentPeriodEnd = toIsoFromUnix((sub as any).current_period_end);
      const trialUntil = toIsoFromUnix((sub as any).trial_end);

      if (event.type === "customer.subscription.deleted") {
        // zrušené
        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "canceled", current_period_end: null, trial_until: null })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) return NextResponse.json({ received: true, note: "db update failed", db_error: error.message });
        return NextResponse.json({ received: true });
      }

      const planFromSub = inferPlanFromSubscription(sub) ?? (sub.metadata?.plan as any) ?? null;

      const patch: any = {
        status: sub.status,
        current_period_end: currentPeriodEnd,
        trial_until: trialUntil,
      };
      if (customerId) patch.stripe_customer_id = customerId;
      if (planFromSub) patch.plan = planFromSub;

      if (userId) {
        const { error } = await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            ...patch,
          },
          { onConflict: "user_id" }
        );
        if (error) return NextResponse.json({ received: true, note: "db upsert failed", db_error: error.message });
      } else {
        const { error } = await supabase.from("subscriptions").update(patch).eq("stripe_subscription_id", subscriptionId);
        if (error) return NextResponse.json({ received: true, note: "db update failed", db_error: error.message });
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}