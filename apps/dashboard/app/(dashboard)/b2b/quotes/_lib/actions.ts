'use server';

import { api } from '@/lib/api-rest-client';

export async function quoteLifecycleAction(
  quoteId: string,
  action: 'accept' | 'decline'
): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/b2b/quotes/${quoteId}/${action}`, {});
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Action failed' };
  }
}

// A merchant prices each line either directly (`unitPriceCents`) or "by markup"
// (docs/48 §5): a markup directive against a cost basis (`costCents`, else the
// linked variant cost), snapshotted onto the line by api-rest.
export type LineMarkupDirective =
  | { kind: 'rule'; ruleId: string }
  | {
      kind: 'adhoc';
      method: 'percentage' | 'multiplier' | 'flat' | 'margin_target';
      value: number;
    };

export interface RespondLine {
  itemId: string;
  unitPriceCents?: number;
  costCents?: number;
  markup?: LineMarkupDirective;
}

export async function respondToQuote(
  quoteId: string,
  lineItems: RespondLine[],
  merchantNote?: string
): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/b2b/quotes/${quoteId}/respond`, { lineItems, merchantNote });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to submit response' };
  }
}
