import 'server-only';

// Server-side loader for the customer wizard's optional "Start a draft quote"
// step. Resolves the tenant's system `b2b-quotes` BillingDocument workflow id
// (docs/87 §15 convergence — a quote IS a BillingDocument on that workflow) so
// the client wizard can create against it without a client-side lookup.
// Returns null when invoicing isn't enabled (or the workflow hasn't been
// seeded yet) — the quote card then degrades to a "not available" hint,
// same as the deal card's "create a pipeline first" fallback.

import { api } from '@/lib/api-rest-client';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@sparx/crm-schemas/builtins';

interface RawWorkflow {
  id: string;
  slug: string;
}

export async function loadQuoteWorkflowId(): Promise<string | null> {
  try {
    const rows = await api.get<RawWorkflow[]>('/v1/invoicing/workflows?take=250');
    return rows.find((w) => w.slug === B2B_QUOTE_WORKFLOW_SLUG)?.id ?? null;
  } catch {
    return null;
  }
}
