// Provider adapters must verify the raw webhook signature before returning an event.
// No client redirect or client-supplied plan identifier may activate a subscription.
export type BillingEvent={providerEventId:string;workspaceId:string;plan:'free'|'pro'|'business';status:'active'|'past_due'|'canceled';effectiveAt:string};
export interface BillingProvider{
 createCheckout(input:{workspaceId:string;plan:'pro'|'business';period:'monthly'|'annual';returnUrl:string}):Promise<{url:string}>;
 createPortal(workspaceId:string):Promise<{url:string}>;
 verifyWebhook(rawBody:string,signature:string):Promise<BillingEvent>;
}
export function configuredBillingProvider():BillingProvider|null{return null;}
