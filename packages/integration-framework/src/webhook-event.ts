// The verified inbound webhook every provider kind produces.
//
// This lived in `payment-provider.ts` — which was deleted, because the payment
// contract it sat beside was a second model of payments that nothing dispatched (see
// the note on `ProviderBundle`). The type itself was never payment-specific: it is
// what `ShippingProvider.verifyWebhook` returns and what the webhook router consumes,
// so it now lives on its own rather than inside a kind that no longer exists.

export interface WebhookEvent {
  /** The provider's own event id — the idempotency key the router dedupes on. */
  providerEventId: string;
  /** The provider's event name, e.g. "transaction.updated". */
  providerEventType: string;
  payload: unknown;
}
