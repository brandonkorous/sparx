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

export interface CommerceSettings {
  defaultCurrency: string;
  defaultLocale: string;
  defaultWarehouseId: string | null;
  channelsEnabled: string[];
  cartAbandonmentMinutes: number;
  showStockBelow: number;
  hidePricesWhenSignedOut: boolean;
  requireAuthForCheckout: boolean;
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
}

export function useUpdateCommerceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CommerceSettingsInput) =>
      api.patch('/v1/commerce/site/settings', input),
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
