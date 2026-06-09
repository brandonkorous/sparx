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

interface RespondItem {
  itemId: string;
  unitPriceCents: number;
}

export async function respondToQuote(
  quoteId: string,
  lineItems: RespondItem[],
  merchantNote?: string
): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/b2b/quotes/${quoteId}/respond`, { lineItems, merchantNote });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to submit response' };
  }
}
