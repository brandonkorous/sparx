import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { channelKeyLabel } from '../../lib/console/channels';
import { inThisConsolesWords, type QueryResponse } from './data';

// THE DASHBOARD WAS THE SIXTH PLACE THAT NAMED A SALES CHANNEL.
//
// `lib/console/channels.ts` is the one set of words for where a sale came from.
// Its header records why: one till sale read "In person or by phone" on Money,
// "Added by your team" on the selling report, "Entered by your team" on the
// order and "Orders you enter by hand" in the price-list picker — same order,
// same $96, four answers (issue 260). It then records a fifth, the customer
// reports pane drawing the API's wording.
//
// The Sales dashboard was a sixth, and it showed a sole trader "Added by your
// team" from a table in api-rest that ALSO had no entry for `pos`, so a till
// sale would have drawn the raw key.
//
// The fix is a swap at `useDashboardQuery`, off the row's KEY. This holds the
// two halves of that: the words still come from the one file, and the swap is
// still wired up.

describe('where a sale came from, on a dashboard', () => {
  it('uses the words the rest of the console uses', () => {
    expect(channelKeyLabel('admin')).toBe('Added by hand');
    expect(channelKeyLabel('pos')).toBe('At the till');
    expect(channelKeyLabel('storefront')).toBe('Your website');
    expect(channelKeyLabel('b2b_portal')).toBe('Wholesale portal');
  });

  it('never tells a sole trader about a team', () => {
    // Every key the table knows, not a sample of them: the failure this guards
    // was ONE entry out of nine.
    const source = readFileSync(
      join(import.meta.dirname, '..', '..', 'lib', 'console', 'channels.ts'),
      'utf8'
    );
    const keys = [...source.matchAll(/^\s{2}([a-z_]+):\s/gm)].map((m) => m[1] as string);
    // The denominator. A regex that matched nothing would pass in silence.
    expect(keys.length).toBeGreaterThan(12);
    for (const key of keys) {
      expect(channelKeyLabel(key).toLowerCase(), `${key} mentions a team`).not.toContain('team');
    }
  });

  // The swap itself, run over a response shaped like the real one. The first
  // draft of this test read `data.ts` and asserted it CONTAINED the word
  // `channelKeyLabel` — which it still does after the swap is deleted, because
  // the import stays. It passed with the bug reinstalled.
  // [[feedback_a_test_that_cannot_go_red]]
  function response(metric: string, label: string): QueryResponse {
    return {
      range: { from: '2026-09-01', to: '2026-09-30', grain: 'day' },
      property: null,
      results: [
        {
          key: 't0',
          metric,
          shape: 'breakdown',
          status: 'ok',
          unit: 'currency',
          data: { rows: [{ key: 'admin', label, value: 71_300, sharePct: 29.8 }] },
        },
      ],
    };
  }
  const firstLabel = (r: QueryResponse): string | undefined =>
    (r.results[0]?.data as { rows: { label: string }[] } | undefined)?.rows[0]?.label;

  it('rewrites a channel breakdown into this console’s words', () => {
    const out = inThisConsolesWords(response('commerce.revenue.by_channel', 'Added by your team'));
    expect(firstLabel(out)).toBe('Added by hand');
  });

  it('leaves a metric that is not keyed by channel alone', () => {
    // `key` is a channel slug only on the metrics listed. Rewriting every
    // breakdown by its key would turn a product id into a sales channel.
    const out = inThisConsolesWords(response('commerce.products.top', 'Marlow Knit'));
    expect(firstLabel(out)).toBe('Marlow Knit');
  });
});
