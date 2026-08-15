'use client';

// Whether this business has done the first few real things yet.
//
// ── WHY THERE IS NO WIZARD ──────────────────────────────────────────────────
//
// sparx greets a new account with `OnboardingGate` — a six-step wizard that owns
// the whole viewport, and whose spine is the MODULES step, because modules are
// what sparx bills for. Piggles includes every app in one flat price
// (piggles/CLAUDE.md RULE #2), so that step does not exist here; and a wizard
// that opens over a working console contradicts the one promise this product
// makes, which is that you are already in.
//
// getpiggles has also already asked the two questions worth asking — what the
// business is called, and what it does — and used the answers to name the
// business, pick the rail and turn on the right apps. Asking again in the
// console would be the software forgetting a conversation it just had.
//
// So the first run is not a gate. It is three real jobs on the Home screen,
// which disappear as they get done, and which nothing forces anybody to do.
//
// ── EVERY TICK IS A SERVER COUNT ────────────────────────────────────────────
//
// A checklist that ticks itself off wrongly is worse than no checklist: it tells
// somebody they have done something they have not, and the first time they find
// out is when a customer does. So each step reads the same `total` the real list
// screen reads, and there is deliberately no path that turns "we could not
// check" into a tick — an unknown step renders as a step with no answer yet,
// which is the truth.

import { useQuery } from '@sparx/query';
import { api } from '@/lib/api/client';
import { useReachableModules } from '@/lib/surfaces/use-visible-nav';

/** What we know about one first-run job. */
export type StepState =
  /** The app behind it is not on, so the job does not apply to this business. */
  | 'off'
  /** Still asking. */
  | 'asking'
  /** We asked and could not get an answer. Never rendered as done or not-done. */
  | 'unknown'
  | 'done'
  | 'todo';

export type FirstRunKey = 'product' | 'customer' | 'invoice';

interface Source {
  module: string;
  path: string;
  /**
   * The query key, deliberately nested UNDER the key root each list already
   * invalidates when something is created.
   *
   * ── WHY IT IS NOT ITS OWN KEY ─────────────────────────────────────────────
   *
   * It was `['piggles', 'first-run', key]`, which belonged to nothing and so was
   * refreshed by nothing. Adding the first product through the form left the
   * checklist saying "Add the first thing you sell" with the product sitting one
   * tab away — the panel telling somebody they had not done the thing they had
   * just watched themselves do, which is worse than no panel at all.
   *
   * `useCreateProduct` already invalidates `productKeys.lists()`,
   * `useCreateCustomer` invalidates `customerKeys.all`, and every invoicing
   * write invalidates `['invoicing']`. Sitting underneath those means the tick
   * refreshes on exactly the events that could change it, with no polling, no
   * second invalidation to keep in step, and no way for the tick and the list to
   * disagree — which is the property this file was always after.
   */
  key: readonly string[];
}

// The same endpoints the real list screens use, so a tick here and a row over
// there can never disagree. `take: 1` because only `total` is wanted.
//
// TWO OF THESE THREE WERE WRONG and the checklist could not say so. They read
// `/v1/products` and `/v1/customers`; the console's own list panes call
// `/v1/commerce/products` (products-data.ts) and `/v1/crm/customers`
// (customers-data.ts). The requests failed, `useStep` turned the failure into
// `unknown`, and `unknown` drew the same empty ring as `todo` — so a business
// that had just added its first product was told, in a panel about first
// products, that it had not added one. Check any new path against the LIST that
// owns it, never against the shape of its neighbours.
const SOURCES: Record<FirstRunKey, Source> = {
  product: {
    module: 'commerce',
    path: '/v1/commerce/products',
    key: ['commerce', 'products', 'list', 'first-run'],
  },
  customer: { module: 'crm', path: '/v1/crm/customers', key: ['crm', 'customers', 'first-run'] },
  invoice: {
    module: 'invoicing',
    path: '/v1/invoicing/documents',
    key: ['invoicing', 'documents', 'first-run'],
  },
};

function useStep(key: FirstRunKey): StepState {
  const source = SOURCES[key];
  const reachable = useReachableModules();
  // `null` means the activation list has not arrived. Treat that as ON so the
  // query runs and the step settles, rather than blinking the whole checklist
  // out and back on every load.
  const enabled = reachable === null || reachable.has(source.module);

  const result = useQuery({
    queryKey: source.key,
    queryFn: () => api.list<unknown>(source.path, { take: 1, skip: 0 }),
    enabled,
    // Long, but NOT Infinity. A first product cannot un-happen, so there is
    // nothing to poll for — but "never re-ask" was how the answer got stuck at
    // zero across the very act it exists to notice. The refresh comes from the
    // invalidation above; this only stops the three requests firing again every
    // time Home is looked at.
    staleTime: 5 * 60 * 1000,
  });

  if (!enabled) return 'off';
  if (result.isError) return 'unknown';
  if (result.isPending || !result.data) return 'asking';
  if (typeof result.data.total !== 'number') return 'unknown';
  return result.data.total > 0 ? 'done' : 'todo';
}

export interface FirstRun {
  steps: Record<FirstRunKey, StepState>;
  /** Every step that applies has been done. The checklist retires itself. */
  finished: boolean;
  /** At least one step still has no answer — so nothing is claimed either way. */
  settled: boolean;
}

/**
 * The first-run state, or the honest absence of one.
 *
 * `finished` is deliberately strict: it is only true once every applicable step
 * has actually come back done. A step we could not check keeps the checklist on
 * screen, because hiding it would be the same lie as ticking it.
 */
export function useFirstRun(): FirstRun {
  const steps: Record<FirstRunKey, StepState> = {
    product: useStep('product'),
    customer: useStep('customer'),
    invoice: useStep('invoice'),
  };

  const applicable = Object.values(steps).filter((state) => state !== 'off');
  const settled = applicable.every((state) => state !== 'asking');
  const finished =
    settled && applicable.length > 0 && applicable.every((state) => state === 'done');

  return { steps, finished, settled };
}
