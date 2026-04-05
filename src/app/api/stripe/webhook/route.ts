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

function inferPlanFromPriceId(priceId: string | null): "basic" | "plus" {
  return priceId === process.env.STRIPE_PRICE_PLUS ? "plus" : "basic";
}

async function resolveUserIdFromCustomer(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerId: string | null
) {
  if (!customerId) return null;

  // 1) skús DB väzbu
  const { data: row } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (row?.user_id) return row.user_id as string;

  // 2) skús customer metadata
  try {
    const cust = await stripe.customers.retrieve(customerId);
    if (!("deleted" in cust) && cust?.metadata?.user_id) {
      return cust.metadata.user_id;
    }
  } catch {}

  return null;
}

async function getCanonicalSubscriptionForCustomer(customerId: string) {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  return (
    subs.data.find((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status)) ??
    subs.data[0] ??
    null
  );
}

async function syncCustomerToDb(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerId: string
) {
  const userId = await resolveUserIdFromCustomer(supabase, customerId);
  if (!userId) {
    return { ok: false as const, reason: "missing_user_id" };
  }

  const canonical = await getCanonicalSubscriptionForCustomer(customerId);

  // customer existuje, ale subscription už žiadna nie je
  if (!canonical) {
    const { error } = await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        plan: "basic",
        status: "inactive",
        current_period_end: null,
        trial_until: null,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return { ok: false as const, reason: error.message };
    }

    return { ok: true as const };
  }

  const priceId = canonical.items.data[0]?.price?.id ?? null;
  const plan = inferPlanFromPriceId(priceId);
  const status = canonical.status === "unpaid" ? "past_due" : canonical.status;
console.log("STRIPE SYNC DEBUG", {
  customerId,
  subscriptionId: canonical.id,
  status: canonical.status,
  trial_end: canonical.trial_end,
  current_period_end: (canonical as any).current_period_end,
  cancel_at_period_end: canonical.cancel_at_period_end,
  cancel_at: canonical.cancel_at,
  canceled_at: canonical.canceled_at,
});
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: canonical.id,
      plan,
      status,
      current_period_end: toIsoFromUnix((canonical as any).current_period_end ?? null),
      trial_until: toIsoFromUnix(canonical.trial_end ?? null),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false as const, reason: error.message };
  }

  return { ok: true as const };
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    // checkout completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;

      if (!customerId) {
        return NextResponse.json({ received: true, note: "missing customerId" });
      }

      const result = await syncCustomerToDb(supabase, customerId);
      return NextResponse.json({ received: true, sync: result });
    }

    // subscription create/update/delete
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId =
        typeof sub.customer === "string"
          ? sub.customer
          : sub.customer?.id ?? null;

      if (!customerId) {
        return NextResponse.json({ received: true, note: "missing customerId" });
      }

      const result = await syncCustomerToDb(supabase, customerId);
      return NextResponse.json({ received: true, sync: result });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}