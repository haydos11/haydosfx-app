import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripeServer() {
  if (stripeSingleton) return stripeSingleton;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  stripeSingleton = new Stripe(secretKey);

  return stripeSingleton;
}

export function getPremiumPriceIdSet() {
  const raw = process.env.STRIPE_PREMIUM_PRICE_IDS ?? "";

  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}