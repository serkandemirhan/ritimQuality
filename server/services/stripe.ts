import Stripe from 'stripe';

let instance: Stripe | undefined;

export function stripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  instance ||= new Stripe(process.env.STRIPE_SECRET_KEY);
  return instance;
}

