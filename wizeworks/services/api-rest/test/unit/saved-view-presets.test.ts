import { describe, expect, it } from 'vitest';
import { SAVED_VIEW_PRESETS } from '../../src/lib/saved-view-presets.js';

/**
 * A SAVED VIEW IS A SNAPSHOT OF A URL, AND A URL IS TEXT.
 *
 * The presets ship as `Record<string, string>` and the console types its whole
 * saved-view pipeline the same way: `normalise()` drops a param by comparing
 * `value !== ''`, and the list spreads the result into its query. A non-string
 * value in there is not a style choice, it is a different kind of thing in a
 * structure that only understands one kind.
 *
 * It got in anyway. The Overdue preset was written `{ pastDue: true }`, a real
 * boolean, and shipped alongside a migration that wrote that same boolean into
 * 63 tenants' rows. Only `tsc` objected, and `tsc` was reported as passing when
 * it had not been run. So this says the same thing where the test suite can see
 * it: a preset that stops being text reddens here, in one second, with the
 * preset named.
 *
 * Conversion belongs at the EDGE. The route reads `pastDue` back into a real
 * boolean with `queryBool`, which is the one place that knows a query string is
 * arriving.
 */
describe('every saved-view preset is a URL, spelled as text', () => {
  const all = Object.entries(SAVED_VIEW_PRESETS).flatMap(([module, presets]) =>
    presets.map((preset) => ({ module, preset }))
  );

  it('ships presets at all, so an empty catalog cannot pass silently', () => {
    // A denominator, not a target. Every assertion below iterates, and an
    // iteration over nothing is green for the wrong reason.
    //
    // Deliberately loose. The first draft asserted "more than 20" and went red
    // the same day, when five presets were removed for pointing at screens that do not
    // exist — which was the work being correct, not the catalog being broken. A
    // guard that has to be edited every time the thing it watches legitimately
    // changes is a guard people learn to edit without reading.
    expect(all.length).toBeGreaterThan(5);
    expect(SAVED_VIEW_PRESETS.invoicing?.length).toBeGreaterThan(0);
  });

  it('has only string values in every preset params object', () => {
    const wrong = all
      .flatMap(({ module, preset }) =>
        Object.entries(preset.params).map(([key, value]) => ({ module, preset, key, value }))
      )
      .filter(({ value }) => typeof value !== 'string');

    expect(
      wrong.map((w) => `${w.module} · ${w.preset.name} · ${w.key} = ${typeof w.value}`)
    ).toEqual([]);
  });

  it('survives the round trip through a query string unchanged', () => {
    // The real test of "is this a URL". A boolean `true` survives it too, by
    // being coerced to "true" on the way out and never coming back — which is
    // exactly how the wrong shape went unnoticed until the types were read.
    for (const { module, preset } of all) {
      const query = new URLSearchParams(preset.params);
      expect(Object.fromEntries(query), `${module} · ${preset.name}`).toEqual(preset.params);
    }
  });

  it('names a route and a view for every preset', () => {
    for (const { module, preset } of all) {
      expect(preset.target.startsWith('/'), `${module} · ${preset.name}`).toBe(true);
      expect(preset.name.trim(), `${module} · ${preset.target}`).not.toBe('');
    }
  });

  it('asks the Overdue invoice view for the due date, not the status column', () => {
    // The defect this file was written for, stated as itself. `status: overdue`
    // is a stored word nothing rewrites when a date passes, so the view built to
    // show late money could not see most of it.
    const overdue = SAVED_VIEW_PRESETS.invoicing?.find(
      (p) => p.target === '/invoicing/invoices' && p.name === 'Overdue'
    );
    expect(overdue?.params).toEqual({ pastDue: 'true' });
  });
});
