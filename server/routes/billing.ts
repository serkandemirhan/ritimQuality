import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type Stripe from 'stripe';
import { pool, withTenant } from '../db/pool.js';
import { planFromPriceId, stripePriceId } from '../config/plans.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { stripeClient } from '../services/stripe.js';
import { audit } from '../services/access.js';

export const billingRouter = Router();
billingRouter.use(requireAuth, requireRole('admin'));

billingRouter.post('/checkout', async (req, res, next) => {
  try {
    const { planId, billingPeriod } = z.object({
      planId: z.enum(['starter', 'pro', 'enterprise']),
      billingPeriod: z.enum(['monthly', 'annual']),
    }).parse(req.body);
    const { tenantId, userId } = req.auth!;
    const stripe = stripeClient();
    const tenantResult = await pool.query(
      'SELECT name, contact_email, stripe_customer_id, stripe_subscription_id FROM tenants WHERE id=$1',
      [tenantId],
    );
    const tenant = tenantResult.rows[0];
    if (!tenant) { res.status(404).json({ error: 'Firma bulunamadı.' }); return; }

    let customerId = tenant.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        email: tenant.contact_email,
        metadata: { tenantId },
      });
      customerId = customer.id;
      await pool.query('UPDATE tenants SET stripe_customer_id=$2,updated_at=now() WHERE id=$1', [tenantId, customerId]);
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    if (tenant.stripe_subscription_id) {
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl}/?billing=portal-return` });
      res.json({ url: portal.url });
      return;
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: stripePriceId(planId, billingPeriod), quantity: 1 }],
      success_url: `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?billing=canceled`,
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      client_reference_id: tenantId,
      metadata: { tenantId, userId, planId, billingPeriod },
      subscription_data: { metadata: { tenantId, userId, planId, billingPeriod } },
    });
    res.json({ url: session.url });
  } catch (error) { next(error); }
});

billingRouter.post('/portal', async (req, res, next) => {
  try {
    const { tenantId } = req.auth!;
    const result = await pool.query('SELECT stripe_customer_id FROM tenants WHERE id=$1', [tenantId]);
    const customerId = result.rows[0]?.stripe_customer_id;
    if (!customerId) { res.status(409).json({ error: 'Stripe müşteri kaydı henüz oluşmamış.' }); return; }
    const session = await stripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL || 'http://localhost:3000'}/?billing=portal-return`,
    });
    res.json({ url: session.url });
  } catch (error) { next(error); }
});

function mappedStatus(status: Stripe.Subscription.Status): 'trial' | 'active' | 'past_due' | 'canceled' {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trial';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
  return 'canceled';
}

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const tenantId = subscription.metadata.tenantId;
  const priceId = subscription.items.data[0]?.price.id;
  const mappedPlan = priceId ? planFromPriceId(priceId) : null;
  if (!tenantId || !mappedPlan) throw new Error(`Subscription ${subscription.id} has invalid tenant or price metadata`);
  const renewsAt = (subscription.items.data[0] as Stripe.SubscriptionItem & { current_period_end?: number } | undefined)?.current_period_end
    ?? (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  await pool.query(
    `UPDATE tenants SET stripe_customer_id=$2,stripe_subscription_id=$3,stripe_price_id=$4,
      plan_id=$5, billing_period=$6, subscription_status=$7,
      subscription_renews_at=to_timestamp($8::double precision),updated_at=now() WHERE id=$1`,
    [tenantId, String(subscription.customer), subscription.id, priceId, mappedPlan.planId,
      mappedPlan.billingPeriod, mappedStatus(subscription.status), renewsAt || null],
  );
}

export async function stripeWebhookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      res.status(400).json({ error: 'Stripe webhook signature is missing.' }); return;
    }
    const event = stripeClient().webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    const alreadyHandled = await pool.query('SELECT 1 FROM stripe_events WHERE event_id=$1', [event.id]);
    if (alreadyHandled.rowCount) { res.json({ received: true, duplicate: true }); return; }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
      const tenantId = subscription.metadata.tenantId;
      if (tenantId) {
        await withTenant(tenantId, client => audit(client, {
          tenantId, userId: subscription.metadata.userId,
          action: `stripe.${event.type}`, entityType: 'subscription', entityId: subscription.id,
          after: { status: subscription.status, priceId: subscription.items.data[0]?.price.id },
        }));
      }
    }
    await pool.query('INSERT INTO stripe_events (event_id,event_type) VALUES ($1,$2)', [event.id, event.type]);
    res.json({ received: true });
  } catch (error) { next(error); }
}
