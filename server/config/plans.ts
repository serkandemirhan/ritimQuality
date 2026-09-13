export type PlanId = 'starter' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'annual';

export const PLAN_LIMITS: Record<PlanId, { controlPlans: number; users: number; monthlyMeasurements: number }> = {
  starter: { controlPlans: 5, users: 3, monthlyMeasurements: 2_500 },
  pro: { controlPlans: 50, users: 15, monthlyMeasurements: 25_000 },
  enterprise: { controlPlans: 9_999, users: 9_999, monthlyMeasurements: 999_999 },
};

export function stripePriceId(plan: PlanId, period: BillingPeriod): string {
  const key = `STRIPE_${plan.toUpperCase()}_${period.toUpperCase()}_PRICE_ID`;
  const priceId = process.env[key];
  if (!priceId) throw new Error(`${key} is not configured`);
  return priceId;
}

export function planFromPriceId(priceId: string): { planId: PlanId; billingPeriod: BillingPeriod } | null {
  for (const planId of Object.keys(PLAN_LIMITS) as PlanId[]) {
    for (const billingPeriod of ['monthly', 'annual'] as BillingPeriod[]) {
      if (process.env[`STRIPE_${planId.toUpperCase()}_${billingPeriod.toUpperCase()}_PRICE_ID`] === priceId) {
        return { planId, billingPeriod };
      }
    }
  }
  return null;
}
