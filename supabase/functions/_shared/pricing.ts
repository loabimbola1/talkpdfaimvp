// Shared pricing configuration for payment processing
// SINGLE SOURCE OF TRUTH for all payment-related functions
// Updated Jan 2026: Plus ₦3,500/₦36,000, Pro ₦8,500/₦84,000

export type BillingCycle = "monthly" | "yearly";

export const PRICE_MAP: Record<string, Record<BillingCycle, number>> = {
  plus: { monthly: 3500, yearly: 36000 },
  pro: { monthly: 8500, yearly: 84000 },
};

export const VALID_PLANS = Object.keys(PRICE_MAP);

export const CURRENCY = "NGN";
