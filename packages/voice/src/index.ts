// sparx voice — a provider-agnostic calling abstraction (docs/144 §5.6).
//
// Mirrors @sparx/sms module for module: one interface every caller uses, a
// console fallback so the full path runs without a vendor, and a registry that
// selects on configured credentials. The difference is whose credentials those
// are — a tenant's own, never the platform's.

export * from './provider';
export * from './registry';
export { ConsoleVoiceProvider } from './providers/console';
export { TwilioVoiceProvider, outcomeFor } from './providers/twilio';
