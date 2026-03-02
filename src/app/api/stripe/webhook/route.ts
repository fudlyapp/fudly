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
    // ===============================
    // CHECKOUT COMPLETED
    // ===============================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.user_id;
      const planFromMetadata = (session.metadata?.plan as "basic" | "plus" | undefined) ?? undefined;

      const subscriptionId = (session.subscription as string | null) ?? null;
      const customerId = (session.customer as string | null) ?? null;

      if (!userId || !subscriptionId || !customerId) {
        return NextResponse.json({ received: true });
      }

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const planFromSub = inferPlanFromSubscription(sub) ?? "basic";
      const plan = planFromMetadata ?? planFromSub;

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
    }

    // ===============================
    // SUBSCRIPTION CREATED (doplnené)
    // ===============================
    if (event.type === "customer.subscription.created") {
      const sub = event.data.object as Stripe.Subscription;

      const subscriptionId = sub.id;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

      const planFromSub = inferPlanFromSubscription(sub) ?? "basic";
      const currentPeriodEnd = toIsoFromUnix((sub as any).current_period_end);
      const trialUntil = toIsoFromUnix((sub as any).trial_end);

      // user_id nemusí byť na 100% v Stripe pri portal zmene,
      // ale často metadata býva zachované – skúsime ho vytiahnuť.
      const userId = (sub.metadata?.user_id as string | undefined) ?? undefined;

      if (userId) {
        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId ?? null,
            stripe_subscription_id: subscriptionId,
            plan: planFromSub,
            status: sub.status,
            current_period_end: currentPeriodEnd,
            trial_until: trialUntil,
          },
          { onConflict: "user_id" }
        );
      } else {
        // ak user_id nemáme, aspoň updatuj podľa subscription_id (ak už existuje row)
        await supabase
          .from("subscriptions")
          .update({
            stripe_customer_id: customerId ?? null,
            plan: planFromSub,
            status: sub.status,
            current_period_end: currentPeriodEnd,
            trial_until: trialUntil,
          })
          .eq("stripe_subscription_id", subscriptionId);
      }
    }

    // ===============================
    // SUBSCRIPTION UPDATED (FIX: aj plan)
    // ===============================
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;

      const subscriptionId = sub.id;

      const currentPeriodEnd = toIsoFromUnix((sub as any).current_period_end);
      const trialUntil = toIsoFromUnix((sub as any).trial_end);

      const planFromSub = inferPlanFromSubscription(sub);

      const patch: any = {
        status: sub.status,
        current_period_end: currentPeriodEnd,
        trial_until: trialUntil,
      };

      // ✅ toto ti doteraz chýbalo
      if (planFromSub) patch.plan = planFromSub;

      await supabase.from("subscriptions").update(patch).eq("stripe_subscription_id", subscriptionId);
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
          // plan nechávam, aby si vedel zobraziť históriu; ak chceš, môžem ho dať na "basic"
        })
        .eq("stripe_subscription_id", subscriptionId);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}