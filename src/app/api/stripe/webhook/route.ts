import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, );

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

async function resolveUserIdFromEvent(
  event: Stripe.Event
): Promise<{ userId: string | null; customerId: string | null; subscriptionId: string | null }> {
  // checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const subscriptionId = (session.subscription as string | null) ?? null;
    const customerId = (session.customer as string | null) ?? null;

    const userId =
      (session.metadata?.user_id as string | undefined) ??
      (session.client_reference_id as string | undefined) ??
      null;

    return { userId, customerId, subscriptionId };
  }

  // subscription events
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const subscriptionId = sub.id;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

    let userId = (sub.metadata?.user_id as string | undefined) ?? null;

    // poistka: ak nemáme userId, skús customer metadata (ak customer vytvárame my)
    if (!userId && customerId) {
      const cust = await stripe.customers.retrieve(customerId);
      if (!("deleted" in cust) && cust?.metadata?.user_id) userId = cust.metadata.user_id;
    }

    return { userId, customerId, subscriptionId };
  }

  return { userId: null, customerId: null, subscriptionId: null };
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    const { userId, customerId, subscriptionId } = await resolveUserIdFromEvent(event);

    // ===============================
    // CHECKOUT COMPLETED
    // ===============================
    if (event.type === "checkout.session.completed") {
      if (!userId || !subscriptionId || !customerId) {
        // nechceme failovať webhook, ale toto je presne dôvod “nič sa neprepne”
        return NextResponse.json({ received: true, note: "missing userId/subscriptionId/customerId" });
      }

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const plan = (sub.metadata?.plan as "basic" | "plus" | undefined) ?? inferPlanFromSubscription(sub) ?? "basic";

      const currentPeriodEnd = toIsoFromUnix((sub as any).current_period_end);
      const trialUntil = toIsoFromUnix((sub as any).trial_end);

      await supabase.from("subscriptions").upsert(
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

      return NextResponse.json({ received: true });
    }

    // ===============================
    // SUBSCRIPTION CREATED / UPDATED
    // ===============================
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      if (!subscriptionId) return NextResponse.json({ received: true });

      const sub = event.data.object as Stripe.Subscription;

      const planFromSub = inferPlanFromSubscription(sub) ?? (sub.metadata?.plan as any) ?? null;
      const currentPeriodEnd = toIsoFromUnix((sub as any).current_period_end);
      const trialUntil = toIsoFromUnix((sub as any).trial_end);

      const patch: any = {
        status: sub.status,
        current_period_end: currentPeriodEnd,
        trial_until: trialUntil,
      };
      if (customerId) patch.stripe_customer_id = customerId;
      if (planFromSub) patch.plan = planFromSub;

      if (userId) {
        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            ...patch,
          },
          { onConflict: "user_id" }
        );
      } else {
        // fallback: update podľa subscription id (ak row existuje)
        await supabase.from("subscriptions").update(patch).eq("stripe_subscription_id", subscriptionId);
      }

      return NextResponse.json({ received: true });
    }

    // ===============================
    // SUBSCRIPTION DELETED
    // ===============================
    if (event.type === "customer.subscription.deleted") {
      if (!subscriptionId) return NextResponse.json({ received: true });

      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          current_period_end: null,
          trial_until: null,
        })
        .eq("stripe_subscription_id", subscriptionId);

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}