import type { ModuleSlug, ScanEntityDef } from './types';

export const SCAN_ENTITIES: readonly ScanEntityDef[] = [
  { entity: 'customer', label: 'Customers', module: 'crm' },
  { entity: 'b2b_account', label: 'Wholesale customers', module: 'b2b' },
  { entity: 'billing_document', label: 'Quotes & invoices', module: 'invoicing' },
  { entity: 'cart', label: 'Abandoned carts', module: 'commerce' },
  // A quote IS a billing document (the b2b-quotes workflow), so it shares the
  // invoicing hue with billing_document above.
  { entity: 'quote', label: 'Quotes awaiting a decision', module: 'invoicing' },
  // No 'chat' module hue exists (the ModuleSlug union has no 'chat'), and chat
  // lives under Customers — so conversations wear the CRM hue.
  { entity: 'conversation', label: 'Chat conversations', module: 'crm' },
];

export function scanEntityLabel(entity: string): string {
  return SCAN_ENTITIES.find((e) => e.entity === entity)?.label ?? entity;
}

export function moduleForScanEntity(entity: string): ModuleSlug {
  return SCAN_ENTITIES.find((e) => e.entity === entity)?.module ?? 'platform';
}

export const SCHEDULE_CADENCES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'interval', label: 'Every so many minutes' },
  { value: 'once', label: 'Once, at a set time' },
] as const;

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;
