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

async function hasProcessedEvent(stripeEventId: string) {
  const supabase = getAppSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_webhook_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed checking webhook ledger: ${error.message}`);
  }

  return Boolean(data);
}

async function markEventProcessed(event: Stripe.Event) {
  const supabase = getAppSupabaseAdmin();

  const { error } = await supabase.from("billing_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    created_ts: toIsoOrNull(event.created),
  });

  if (error) {
    throw new Error(`Failed writing webhook ledger: ${error.message}`);
  }
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

async function getExistingAccessByCustomerId(stripeCustomerId: string) {
  const supabase = getAppSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_customer_access")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed fetching billing access: ${error.message}`);
  }

  return data as BillingAccessRow | null;
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (!stripeCustomerId) {
    return;
  }

  const email =
    session.customer_details?.email ??
    (typeof session.customer_email === "string"
      ? session.customer_email
      : null);

  const appUserId =
    typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : typeof session.metadata?.user_id === "string"
        ? session.metadata.user_id
        : null;

  const existing = await getExistingAccessByCustomerId(stripeCustomerId);

  await upsertBillingAccess({
    user_id: appUserId ?? existing?.user_id ?? null,
    email: email ?? existing?.email ?? null,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id:
      stripeSubscriptionId ?? existing?.stripe_subscription_id ?? null,
    stripe_price_id: existing?.stripe_price_id ?? null,
    stripe_product_id: existing?.stripe_product_id ?? null,
    plan_key: existing?.plan_key ?? null,
    subscription_status: existing?.subscription_status ?? "checkout_completed",
    premium_active: existing?.premium_active ?? false,
    current_period_end: existing?.current_period_end ?? null,
    cancel_at_period_end: existing?.cancel_at_period_end ?? false,
    last_event_type: event.type,
    last_event_created: toIsoOrNull(event.created),
    metadata: {
      ...(existing?.metadata ?? {}),
      checkout_session_id: session.id,
    },
  });
}

async function handleSubscriptionUpsert(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  if (!stripeCustomerId) {
    return;
  }

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

  const existing = await getExistingAccessByCustomerId(stripeCustomerId);

  await upsertBillingAccess({
    user_id:
      existing?.user_id ??
      (typeof subscription.metadata?.user_id === "string"
        ? subscription.metadata.user_id
        : null),
    email: existing?.email ?? null,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    stripe_product_id: productId,
    plan_key: planKey,
    subscription_status: subscription.status,
    premium_active: premiumActive,
    current_period_end: toIsoOrNull(currentPeriodEnd),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    last_event_type: event.type,
    last_event_created: toIsoOrNull(event.created),
    metadata: {
      ...(existing?.metadata ?? {}),
    },
  });
}

async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!stripeCustomerId) {
    return;
  }

  const existing = await getExistingAccessByCustomerId(stripeCustomerId);
  if (!existing) return;

  const premiumActive =
    existing.plan_key === "premium" &&
    isPremiumStatus(existing.subscription_status);

  await upsertBillingAccess({
    ...existing,
    premium_active: premiumActive,
    last_event_type: event.type,
    last_event_created: toIsoOrNull(event.created),
    metadata: {
      ...(existing.metadata ?? {}),
      last_paid_invoice_id: invoice.id,
    },
  });
}

async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!stripeCustomerId) {
    return;
  }

  const existing = await getExistingAccessByCustomerId(stripeCustomerId);
  if (!existing) return;

  await upsertBillingAccess({
    ...existing,
    premium_active: false,
    last_event_type: event.type,
    last_event_created: toIsoOrNull(event.created),
    metadata: {
      ...(existing.metadata ?? {}),
      last_failed_invoice_id: invoice.id,
    },
  });
}

export async function POST(req: Request) {
  const stripe = getStripeServer();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Webhook signature verification failed";

    return new Response(message, { status: 400 });
  }

  try {
    const alreadyProcessed = await hasProcessedEvent(event.id);
    if (alreadyProcessed) {
      return Response.json({ ok: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionUpsert(event);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;

      default:
        break;
    }

    await markEventProcessed(event);

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";

    return new Response(message, { status: 500 });
  }
}