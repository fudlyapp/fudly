//src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function toIsoFromUnix(unix?: number | null) {
  return unix ? new Date(unix * 1000).toISOString() : null;
}

function getCurrentPeriodEndIso(sub: Stripe.Subscription | null | undefined) {
  if (!sub) return null;

  const topLevel = (sub as any).current_period_end;
  if (typeof topLevel === "number" && Number.isFinite(topLevel)) {
    return toIsoFromUnix(topLevel);
  }

  const itemEnds = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (itemEnds.length > 0) {
    return toIsoFromUnix(Math.max(...itemEnds));
  }

  return null;
}

async function saveSubscriptionRow(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: {
    user_id: string;
    plan: "basic" | "plus" | null;
    status: string | null;
    trial_until: string | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }
) {
  const { error } = await supabase.rpc("upsert_subscription_state", {
    p_user_id: payload.user_id,
    p_plan: payload.plan,
    p_status: payload.status,
    p_trial_until: payload.trial_until,
    p_current_period_end: payload.current_period_end,
    p_stripe_customer_id: payload.stripe_customer_id,
    p_stripe_subscription_id: payload.stripe_subscription_id,
  });

  return { error };
}

function inferPlanFromPriceId(priceId: string | null): "basic" | "plus" {
  return priceId === process.env.STRIPE_PRICE_PLUS ? "plus" : "basic";
}

async function resolveUserIdFromCustomer(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerId: string | null
) {
  if (!customerId) return null;

  const { data: row } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (row?.user_id) return row.user_id as string;

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

  if (!canonical) {
    const payload = {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      plan: "basic" as const,
      status: "inactive",
      current_period_end: null,
      trial_until: null,
    };

    const { error } = await saveSubscriptionRow(supabase, payload);

    if (error) {
      return { ok: false as const, reason: error.message };
    }

    return { ok: true as const };
  }

  const priceId = canonical.items.data[0]?.price?.id ?? null;
  const plan = inferPlanFromPriceId(priceId);
  const status = canonical.status === "unpaid" ? "past_due" : canonical.status;

  const payload = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: canonical.id,
    plan,
    status,
    current_period_end: getCurrentPeriodEndIso(canonical),
    trial_until: toIsoFromUnix(canonical.trial_end ?? null),
  };

  const { error } = await saveSubscriptionRow(supabase, payload);

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