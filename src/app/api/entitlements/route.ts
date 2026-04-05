//src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type Plan = "basic" | "plus";
type Status = "inactive" | "trialing" | "active" | "past_due" | "canceled" | "none";

type SubscriptionRow = {
  user_id: string;
  plan: Plan | null;
  status: Status | null;
  trial_until: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function planLimits(plan: Plan) {
  if (plan === "plus") {
    return {
      weekly_limit: 5,
      calories_enabled: true,
      allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske", "veganske", "fit", "tradicne", "exoticke"],
    };
  }

  return {
    weekly_limit: 3,
    calories_enabled: false,
    allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske"],
  };
}

function parseDateMs(v?: string | null) {
  if (!v) return null;

  let s = v.trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
  }

  if (/[+-]\d{2}$/.test(s)) {
    s = s + ":00";
  }

  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

function isActiveLike(
  status: Status,
  now: number,
  currentPeriodEnd?: string | null,
  trialUntil?: string | null
) {
  if (status === "active") {
    const cpe = parseDateMs(currentPeriodEnd);
    if (!cpe) return true;
    return cpe > now;
  }

  if (status === "trialing") {
    const tu = parseDateMs(trialUntil);
    if (!tu) return false;
    return tu > now;
  }

  if (status === "past_due") {
    const cpe = parseDateMs(currentPeriodEnd);
    if (!cpe) return true;
    return cpe > now;
  }

  return false;
}

function normalizeStripeStatus(status: string): Status {
  if (status === "unpaid") return "past_due";

  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "inactive":
      return "inactive";
    default:
      return "none";
  }
}

function planFromPriceId(priceId: string | null): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PLUS) return "plus";
  if (priceId === process.env.STRIPE_PRICE_BASIC) return "basic";
  return null;
}

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

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

async function getStoredSubscriptionRow(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "user_id, plan, status, trial_until, current_period_end, stripe_customer_id, stripe_subscription_id"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as SubscriptionRow | null) ?? null;
}

async function tryRetrieveSubscriptionById(subscriptionId: string | null) {
  if (!subscriptionId) return null;

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return sub;
  } catch {
    return null;
  }
}

async function listCandidateCustomerIds(
  storedCustomerId: string | null,
  userId: string,
  userEmail: string | null
) {
  const ids: string[] = [];

  if (storedCustomerId) ids.push(storedCustomerId);

  if (!userEmail) return ids;

  const customers = await stripe.customers.list({
    email: userEmail,
    limit: 20,
  });

  const preferred = customers.data
    .filter((c) => c.metadata?.user_id === userId)
    .map((c) => c.id);

  const fallback = customers.data.map((c) => c.id);

  for (const id of [...preferred, ...fallback]) {
    if (!ids.includes(id)) ids.push(id);
  }

  return ids;
}

async function getCanonicalStripeSubscription(customerId: string) {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  return (
    subs.data.find((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status)) ??
    null
  );
}

async function findBestCustomerAndSubscription(
  storedCustomerId: string | null,
  userId: string,
  userEmail: string | null
) {
  const candidateIds = await listCandidateCustomerIds(storedCustomerId, userId, userEmail);

  let firstExistingCustomerId: string | null = null;

  for (const customerId of candidateIds) {
    if (!firstExistingCustomerId) firstExistingCustomerId = customerId;

    const sub = await getCanonicalStripeSubscription(customerId);
    if (sub) {
      return {
        customerId,
        subscription: sub,
      };
    }
  }

  return {
    customerId: firstExistingCustomerId,
    subscription: null,
  };
}

function buildEntitlementsFromDbRow(
  row: SubscriptionRow,
  now: number,
  used: number,
  debug: Record<string, any> = {}
) {
  const plan = row.plan;
  const status = (row.status ?? "none") as Status;

  if (!plan) {
    return {
      ...debug,
      plan: null,
      status,
      active_like: false,
      can_generate: false,
      weekly_limit: 0,
      used,
      remaining: 0,
      calories_enabled: false,
      allowed_styles: [],
      trial_until: row.trial_until,
      current_period_end: row.current_period_end,
      has_stripe_link: !!row.stripe_customer_id,
    };
  }

  const limits = planLimits(plan);
  const active_like = isActiveLike(status, now, row.current_period_end, row.trial_until);

  return {
    ...debug,
    plan,
    status,
    active_like,
    can_generate: active_like && !!row.stripe_customer_id,
    weekly_limit: limits.weekly_limit,
    used,
    remaining: Math.max(0, limits.weekly_limit - used),
    calories_enabled: limits.calories_enabled,
    allowed_styles: limits.allowed_styles,
    trial_until: row.trial_until,
    current_period_end: row.current_period_end,
    has_stripe_link: !!row.stripe_customer_id,
  };
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const authClient = createSupabaseAdminClient();
    const { data: userRes, error: userErr } = await authClient.auth.getUser(token);

    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const userId = userRes.user.id;
    const userEmail = userRes.user.email ?? null;
    const now = Date.now();

    const supabase = createSupabaseAdminClient();

    const url = new URL(req.url);
    const week_start = url.searchParams.get("week_start");

    let used = 0;
    if (week_start && /^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
      const { data: usage, error: usageErr } = await supabase
        .from("generation_usage")
        .select("count")
        .eq("user_id", userId)
        .eq("week_start", week_start)
        .maybeSingle();

      if (usageErr) {
        return NextResponse.json(
          {
            error: usageErr.message,
            debug_user_id: userId,
            debug_email: userEmail,
          },
          { status: 500, headers: noStoreHeaders() }
        );
      }

      used = usage?.count ?? 0;
    }

    const storedRow = await getStoredSubscriptionRow(supabase, userId);

    if (storedRow?.stripe_subscription_id) {
      const exactSub = await tryRetrieveSubscriptionById(storedRow.stripe_subscription_id);

      if (exactSub) {
        const customerId =
          typeof exactSub.customer === "string"
            ? exactSub.customer
            : exactSub.customer?.id ?? storedRow.stripe_customer_id;

        const priceId = exactSub.items.data[0]?.price?.id ?? null;
        const plan = planFromPriceId(priceId);
        const status = normalizeStripeStatus(exactSub.status);
        const trial_until = toIsoFromUnix(exactSub.trial_end ?? null);
        const current_period_end = getCurrentPeriodEndIso(exactSub);

        console.log("ENTITLEMENTS EXACT SUB DEBUG", {
          subscriptionId: exactSub.id,
          status: exactSub.status,
          trial_end: exactSub.trial_end,
          current_period_end_top_level: (exactSub as any).current_period_end,
          current_period_end_item_0: exactSub.items?.data?.[0]?.current_period_end,
          current_period_end_iso: current_period_end,
        });

        const payload = {
          user_id: userId,
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: exactSub.id,
          plan,
          status,
          trial_until,
          current_period_end,
        };

        console.log("ENTITLEMENTS EXACT SUB UPSERT PAYLOAD", payload);

        const { error: upsertError } = await saveSubscriptionRow(supabase, payload);

        if (upsertError) {
          console.log("ENTITLEMENTS EXACT SUB UPSERT ERROR", upsertError);
        }

        const { data: verify, error: verifyError } = await supabase
          .from("subscriptions")
          .select("user_id, plan, status, trial_until, current_period_end, stripe_customer_id, stripe_subscription_id")
          .eq("user_id", userId)
          .maybeSingle();

        console.log("ENTITLEMENTS EXACT SUB VERIFY", { verify, verifyError });

        if (!plan) {
          return NextResponse.json(
            {
              debug_route_version: "entitlements-v4",
              debug_user_id: userId,
              debug_email: userEmail,
              debug_source: "stripe_exact_subscription",
              debug_stored_customer_id: storedRow.stripe_customer_id,
              debug_stored_subscription_id: storedRow.stripe_subscription_id,
              debug_customer_id: customerId ?? null,
              debug_subscription_id: exactSub.id,
              debug_price_id: priceId,
              plan: null,
              status,
              active_like: false,
              can_generate: false,
              weekly_limit: 0,
              used,
              remaining: 0,
              calories_enabled: false,
              allowed_styles: [],
              trial_until,
              current_period_end,
              has_stripe_link: !!customerId,
            },
            { headers: noStoreHeaders() }
          );
        }

        const limits = planLimits(plan);
        const active_like = isActiveLike(status, now, current_period_end, trial_until);

        return NextResponse.json(
          {
            debug_route_version: "entitlements-v4",
            debug_user_id: userId,
            debug_email: userEmail,
            debug_source: "stripe_exact_subscription",
            debug_stored_customer_id: storedRow.stripe_customer_id,
            debug_stored_subscription_id: storedRow.stripe_subscription_id,
            debug_customer_id: customerId ?? null,
            debug_subscription_id: exactSub.id,
            debug_price_id: priceId,
            plan,
            status,
            active_like,
            can_generate: active_like && !!customerId,
            weekly_limit: limits.weekly_limit,
            used,
            remaining: Math.max(0, limits.weekly_limit - used),
            calories_enabled: limits.calories_enabled,
            allowed_styles: limits.allowed_styles,
            trial_until,
            current_period_end,
            has_stripe_link: !!customerId,
          },
          { headers: noStoreHeaders() }
        );
      }
    }

    const found = await findBestCustomerAndSubscription(
      storedRow?.stripe_customer_id ?? null,
      userId,
      userEmail
    );

    if (found.customerId && found.subscription) {
      const sub = found.subscription;
      const customerId = found.customerId;
      const priceId = sub.items.data[0]?.price?.id ?? null;
      const plan = planFromPriceId(priceId);
      const status = normalizeStripeStatus(sub.status);
      const trial_until = toIsoFromUnix(sub.trial_end ?? null);
      const current_period_end = getCurrentPeriodEndIso(sub);

      console.log("ENTITLEMENTS CUSTOMER SCAN DEBUG", {
        subscriptionId: sub.id,
        status: sub.status,
        trial_end: sub.trial_end,
        current_period_end_top_level: (sub as any).current_period_end,
        current_period_end_item_0: sub.items?.data?.[0]?.current_period_end,
        current_period_end_iso: current_period_end,
      });

      const payload = {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        plan,
        status,
        trial_until,
        current_period_end,
      };

      console.log("ENTITLEMENTS CUSTOMER SCAN UPSERT PAYLOAD", payload);

      const { error: upsertError } = await saveSubscriptionRow(supabase, payload);

      if (upsertError) {
        console.log("ENTITLEMENTS CUSTOMER SCAN UPSERT ERROR", upsertError);
      }

      const { data: verify, error: verifyError } = await supabase
        .from("subscriptions")
        .select("user_id, plan, status, trial_until, current_period_end, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();

      console.log("ENTITLEMENTS CUSTOMER SCAN VERIFY", { verify, verifyError });

      if (!plan) {
        return NextResponse.json(
          {
            debug_route_version: "entitlements-v4",
            debug_user_id: userId,
            debug_email: userEmail,
            debug_source: "stripe_customer_scan",
            debug_stored_customer_id: storedRow?.stripe_customer_id ?? null,
            debug_stored_subscription_id: storedRow?.stripe_subscription_id ?? null,
            debug_customer_id: customerId,
            debug_subscription_id: sub.id,
            debug_price_id: priceId,
            plan: null,
            status,
            active_like: false,
            can_generate: false,
            weekly_limit: 0,
            used,
            remaining: 0,
            calories_enabled: false,
            allowed_styles: [],
            trial_until,
            current_period_end,
            has_stripe_link: true,
          },
          { headers: noStoreHeaders() }
        );
      }

      const limits = planLimits(plan);
      const active_like = isActiveLike(status, now, current_period_end, trial_until);

      return NextResponse.json(
        {
          debug_route_version: "entitlements-v4",
          debug_user_id: userId,
          debug_email: userEmail,
          debug_source: "stripe_customer_scan",
          debug_stored_customer_id: storedRow?.stripe_customer_id ?? null,
          debug_stored_subscription_id: storedRow?.stripe_subscription_id ?? null,
          debug_customer_id: customerId,
          debug_subscription_id: sub.id,
          debug_price_id: priceId,
          plan,
          status,
          active_like,
          can_generate: active_like && !!customerId,
          weekly_limit: limits.weekly_limit,
          used,
          remaining: Math.max(0, limits.weekly_limit - used),
          calories_enabled: limits.calories_enabled,
          allowed_styles: limits.allowed_styles,
          trial_until,
          current_period_end,
          has_stripe_link: true,
        },
        { headers: noStoreHeaders() }
      );
    }

    if (
      storedRow &&
      storedRow.plan &&
      storedRow.status &&
      ["trialing", "active", "past_due"].includes(storedRow.status)
    ) {
      return NextResponse.json(
        buildEntitlementsFromDbRow(storedRow, now, used, {
          debug_route_version: "entitlements-v4",
          debug_user_id: userId,
          debug_email: userEmail,
          debug_source: "db_fallback",
          debug_stored_customer_id: storedRow.stripe_customer_id,
          debug_stored_subscription_id: storedRow.stripe_subscription_id,
        }),
        { headers: noStoreHeaders() }
      );
    }

    if (!found.customerId && !storedRow?.stripe_customer_id) {
      return NextResponse.json(
        {
          debug_route_version: "entitlements-v4",
          debug_user_id: userId,
          debug_email: userEmail,
          debug_source: "no_customer",
          debug_stored_customer_id: storedRow?.stripe_customer_id ?? null,
          debug_stored_subscription_id: storedRow?.stripe_subscription_id ?? null,
          plan: null,
          status: "none" as const,
          active_like: false,
          can_generate: false,
          weekly_limit: 0,
          used,
          remaining: 0,
          calories_enabled: false,
          allowed_styles: [],
          trial_until: null,
          current_period_end: null,
          has_stripe_link: false,
        },
        { headers: noStoreHeaders() }
      );
    }

    return NextResponse.json(
      {
        debug_route_version: "entitlements-v4",
        debug_user_id: userId,
        debug_email: userEmail,
        debug_source: "customer_without_subscription",
        debug_stored_customer_id: storedRow?.stripe_customer_id ?? null,
        debug_stored_subscription_id: storedRow?.stripe_subscription_id ?? null,
        debug_customer_id: found.customerId ?? storedRow?.stripe_customer_id ?? null,
        plan: null,
        status: "none" as const,
        active_like: false,
        can_generate: false,
        weekly_limit: 0,
        used,
        remaining: 0,
        calories_enabled: false,
        allowed_styles: [],
        trial_until: null,
        current_period_end: null,
        has_stripe_link: !!(found.customerId ?? storedRow?.stripe_customer_id),
      },
      { headers: noStoreHeaders() }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}