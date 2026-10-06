import { CUSTOMER_TRIGGER_EVENTS } from './trigger-events-customers';
import { OPERATIONS_TRIGGER_EVENTS } from './trigger-events-operations';
import { SELLING_TRIGGER_EVENTS } from './trigger-events-selling';
import type { ModuleSlug, TriggerEventDef } from './types';

/** Curated event suggestions, offered not enforced (free text is still allowed). Every entry is
 *  an event the automation ENGINE actually publishes and can resolve, so no suggestion dangles
 *  a trigger that can't fire. */
export const TRIGGER_EVENTS: readonly TriggerEventDef[] = [
  ...SELLING_TRIGGER_EVENTS,
  ...CUSTOMER_TRIGGER_EVENTS,
  ...OPERATIONS_TRIGGER_EVENTS,
];

/** Map an event type to the part of the business it belongs to (best-effort, for
 *  the module tags on a row). */
export function moduleForEventType(eventType: string): ModuleSlug {
  if (eventType.startsWith('crm.billing_document.')) return 'invoicing';
  const head = eventType.split('.')[0] ?? '';
  if (
    head === 'order' ||
    head === 'product' ||
    head === 'variant' ||
    head === 'inventory' ||
    head === 'return' ||
    head === 'subscription' ||
    head === 'payment'
  ) {
    return 'commerce';
  }
  if (head === 'crm' || head === 'customer' || head === 'deal') return 'crm';
  if (head === 'commerce') return 'commerce';
  if (head === 'b2b') return 'b2b';
  if (head === 'email') return 'email';
  if (head === 'cms' || head === 'content' || head === 'site' || head === 'form') return 'cms';
  if (head === 'social') return 'social';
  if (head === 'funnel') return 'funnels';
  return 'platform';
}
