'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SELLING SETTINGS DATA LAYER
//
// The rules that apply to every sale on this site: the currency prices are in,
// the language dates and numbers use, how a customer must sign in, and how long
// a cart sits before it counts as abandoned. Settings are per-SITE — the api
// client attaches the active site automatically, so this layer never thinks
// about which one it is editing.
//
// Shapes mirror commerceSiteService (GET/PATCH /v1/commerce/site/settings). The
// PATCH replaces the whole settings object, so the editor always sends every
// field back, not a diff.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** What happens when a repeat order's card is declined (docs/142 §4.1). Mirrors
 *  `DunningPolicy` in @sparx/commerce-schemas — the shape the billing engine
 *  actually reads, not a second one for the form. */
export interface DunningPolicy {
  maxAttempts: number;
  /** Hours to wait before each retry. Past the end of the list the last entry
   *  repeats, so a 6-attempt policy with 4 delays stretches rather than
   *  collapsing to hourly. */
  retryDelaysHours: number[];
  finalOutcome: 'cancel' | 'pause' | 'mark_past_due';
  notifyCustomerOnFirstFailure: boolean;
  notifyCustomerOnFinalFailure: boolean;
}

export interface CommerceSettings {
  defaultCurrency: string;
  defaultLocale: string;
  defaultWarehouseId: string | null;
  channelsEnabled: string[];
  cartAbandonmentMinutes: number;
  showStockBelow: number;
  hidePricesWhenSignedOut: boolean;
  requireAuthForCheckout: boolean;
  /** Business-wide, NOT per-site — a repeat order has no site of its own, so
   *  this reads and writes the primary site's row whichever site is open. */
  defaultDunningPolicy: DunningPolicy;
}

const settingsKey = ['commerce', 'site', 'settings'] as const;

/* ── Query ──────────────────────────────────────────────────────────────── */

export function useCommerceSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => api.get<CommerceSettings>('/v1/commerce/site/settings'),
  });
}

/* ── Mutation ───────────────────────────────────────────────────────────── */

/** The write shape. Mirrors UpdateCommerceSiteSettingsInput — a full object,
 *  last-write-wins. `defaultWarehouseId` is carried through untouched so saving
 *  the settings a shop owner CAN edit here never clears the fulfilment origin. */
export interface CommerceSettingsInput {
  defaultCurrency: string;
  defaultLocale: string;
  defaultWarehouseId?: string;
  channelsEnabled: string[];
  cartAbandonmentMinutes: number;
  showStockBelow: number;
  hidePricesWhenSignedOut: boolean;
  requireAuthForCheckout: boolean;
  defaultDunningPolicy?: DunningPolicy;
}

export function useUpdateCommerceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CommerceSettingsInput) => api.patch('/v1/commerce/site/settings', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKey });
    },
  });
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function settingsErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

// The currencies the platform's Currency enum accepts. Kept in step with
// @sparx/crm-schemas' Currency; a value the server would reject never reaches
// the picker.
export const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
  { value: 'NZD', label: 'New Zealand Dollar (NZD)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
];

/* ── Failed repeat payments ─────────────────────────────────────────────── */

// The retry schedule is an array of hours, which is the right shape for the
// engine and the wrong one for a shop owner. These are the schedules worth
// offering, named for the decision behind them rather than their contents. A
// tenant whose stored policy matches none of them (set by API) keeps it — see
// matchRetryPreset.
export const RETRY_PRESETS: { value: string; label: string; hours: number[] }[] = [
  { value: 'standard', label: 'Spread over about 3 weeks', hours: [24, 72, 168, 336] },
  { value: 'quick', label: 'Try again quickly — within a few days', hours: [4, 24, 72] },
  { value: 'patient', label: 'Give them longer — about a month', hours: [48, 168, 336, 720] },
  { value: 'daily', label: 'Once a day', hours: [24] },
];

/** Which preset a stored schedule is, or `custom` when it was set through the
 *  API and matches none. Never silently rewrites it — a policy someone chose
 *  deliberately outranks the tidiness of this picker. */
export function matchRetryPreset(hours: number[]): string {
  const found = RETRY_PRESETS.find(
    (p) => p.hours.length === hours.length && p.hours.every((h, i) => h === hours[i])
  );
  return found?.value ?? 'custom';
}

export const FINAL_OUTCOME_OPTIONS: { value: DunningPolicy['finalOutcome']; label: string }[] = [
  { value: 'pause', label: 'Pause it until they fix their card' },
  { value: 'mark_past_due', label: 'Leave it running and flag it for me' },
  { value: 'cancel', label: 'Cancel it' },
];

function humanizeHours(hours: number): string {
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${String(days)} day${days === 1 ? '' : 's'}`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${String(weeks)} week${weeks === 1 ? '' : 's'}`;
  const months = Math.round(days / 30);
  return `${String(months)} month${months === 1 ? '' : 's'}`;
}

/**
 * The policy as a sentence, so the owner can read back what they just chose
 * instead of inferring it from four controls. The elapsed total mirrors the
 * engine exactly: `retryDelaysHours[attempt - 1]`, falling back to the LAST
 * entry once the list runs out.
 */
export function describeDunningPolicy(policy: DunningPolicy): string {
  const tries = policy.maxAttempts;
  if (tries <= 1) {
    return `We'll try the card once. If it's declined, ${finalOutcomeClause(policy.finalOutcome)}`;
  }
  const delays = policy.retryDelaysHours;
  let total = 0;
  for (let attempt = 1; attempt < tries; attempt += 1) {
    total += delays[attempt - 1] ?? delays[delays.length - 1] ?? 24;
  }
  return `We'll try the card ${String(tries)} times over about ${humanizeHours(total)}. If it still hasn't gone through, ${finalOutcomeClause(policy.finalOutcome)}`;
}

function finalOutcomeClause(outcome: DunningPolicy['finalOutcome']): string {
  switch (outcome) {
    case 'cancel':
      return 'the repeat order is cancelled.';
    case 'mark_past_due':
      return 'the repeat order keeps running and is flagged as overdue for you to deal with.';
    default:
      return 'the repeat order is paused until the customer updates their card.';
  }
}

export const LOCALE_OPTIONS: { value: string; label: string }[] = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-CA', label: 'English (Canada)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'fr-CA', label: 'French (Canada)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'de-DE', label: 'German (Germany)' },
];
