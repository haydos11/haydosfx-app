import Stripe from "stripe";
import { getStripeServer, getPremiumPriceIdSet } from "@/lib/stripe/server";
import { getAppSupabaseAdmin } from "@/lib/supabase/appAdmin";

export const runtime = "nodejs";

type BillingAccessRow = {
  user_id: string | null;
  email: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  plan_key: string | null;
  subscription_status: string | null;
  premium_active: boolean;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  on_hold: boolean;
  hold_type: string | null;
  hold_resumes_at: string | null;
  last_event_type: string | null;
  last_event_created: string | null;
  metadata: Record<string, unknown>;
};

function toIsoOrNull(unixSeconds?: number | null) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function isPremiumStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

function getPlanKeyFromPriceId(priceId: string | null) {
  if (!priceId) return null;

  const premiumPriceIds = getPremiumPriceIdSet();
  if (premiumPriceIds.has(priceId)) return "premium";

  return null;
}

function getCustomerEmail(
  customer: Stripe.Customer | Stripe.DeletedCustomer | string
) {
  if (typeof customer === "string") return null;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.email ?? null;
}

function getCustomerId(
  customer: Stripe.Customer | Stripe.DeletedCustomer | string
) {
  return typeof customer === "string" ? customer : customer.id;
}

function getHoldState(subscription: Stripe.Subscription) {
  const pausedStatus = subscription.status === "paused";
  const hasPauseCollection = Boolean(subscription.pause_collection);

  return {
    onHold: pausedStatus || hasPauseCollection,
    holdType: pausedStatus
      ? "paused"
      : hasPauseCollection
        ? "pause_collection"
        : null,
    holdResumesAt: toIsoOrNull(subscription.pause_collection?.resumes_at ?? null),
  };
}

async function upsertBillingAccess(row: BillingAccessRow) {
  const supabase = getAppSupabaseAdmin();

  const { error } = await supabase.from("billing_customer_access").upsert(row, {
    onConflict: "stripe_customer_id",
  });

  if (error) {
    throw new Error(`Failed upserting billing access: ${error.message}`);
  }
}

async function syncAllSubscriptionsFromStripe() {
  const stripe = getStripeServer();

  let startingAfter: string | undefined;
  let processed = 0;
  let premiumCount = 0;
  let onHoldCount = 0;

  while (true) {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.customer"],
    });

    for (const subscription of page.data) {
      const stripeCustomerId = getCustomerId(subscription.customer);
      const email = getCustomerEmail(subscription.customer);

      const firstItem = subscription.items.data[0];
      const priceId = firstItem?.price?.id ?? null;
      const productId =
        typeof firstItem?.price?.product === "string"
          ? firstItem.price.product
          : firstItem?.price?.product?.id ?? null;
      const currentPeriodEnd = firstItem?.current_period_end ?? null;

      const planKey = getPlanKeyFromPriceId(priceId);
      const premiumActive = Boolean(
        planKey === "premium" && isPremiumStatus(subscription.status)
      );

      const holdState = getHoldState(subscription);

      if (premiumActive) premiumCount += 1;
      if (holdState.onHold) onHoldCount += 1;

      await upsertBillingAccess({
        user_id:
          typeof subscription.metadata?.user_id === "string"
            ? subscription.metadata.user_id
            : null,
        email,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        stripe_product_id: productId,
        plan_key: planKey,
        subscription_status: subscription.status,
        premium_active: premiumActive,
        current_period_end: toIsoOrNull(currentPeriodEnd),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        on_hold: holdState.onHold,
        hold_type: holdState.holdType,
        hold_resumes_at: holdState.holdResumesAt,
        last_event_type: "admin.sync",
        last_event_created: new Date().toISOString(),
        metadata: {
          source: "stripe_sync",
          latest_invoice:
            typeof subscription.latest_invoice === "string"
              ? subscription.latest_invoice
              : subscription.latest_invoice?.id ?? null,
        },
      });

      processed += 1;
    }

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  return {
    processed,
    premiumCount,
    onHoldCount,
  };
}

export async function POST() {
  try {
    const result = await syncAllSubscriptionsFromStripe();

    return Response.json({
      ok: true,
      processed: result.processed,
      premiumCount: result.premiumCount,
      onHoldCount: result.onHoldCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe sync failed";

    return new Response(message, { status: 500 });
  }
}