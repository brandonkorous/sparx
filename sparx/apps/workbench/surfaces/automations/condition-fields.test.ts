import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONDITION_FIELDS,
  conditionFieldItems,
  conditionFieldLabel,
  conditionFieldMatches,
  operatorsFor,
} from './condition-fields';

// The condition picker speaks in an owner's words and offers only details the
// server really fills (sparx persona issue 158). It offered raw code names, three
// of which no resolver ever filled, and none of the details a campaign's own goal
// checks ("they booked", "they paid", "they accepted the quote").

const PACKAGES = resolve(__dirname, '../../../../../wizeworks/packages');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
  });
}

/** Every dotted path a resolver or a scheduled scan writes, read from its source. */
function resolvedPaths(): Set<string> {
  const dirs = [join(PACKAGES, 'automation/src'), join(PACKAGES, 'automation-actions/src')];
  const out = new Set<string>();
  for (const file of dirs.flatMap(sources)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/^\s+'([a-zA-Z0-9]+\.[a-zA-Z0-9.]+)':/gm)) {
      out.add(m[1]!);
    }
  }
  return out;
}

/**
 * Every detail the campaign library's goals check. `event.type` is left out:
 * the library uses it only in a STEP's match ("what happened"), which the
 * campaign shows as a sentence (`funnels/recorded-by.ts`), never in this picker.
 */
function goalPaths(): string[] {
  const library = readFileSync(join(PACKAGES, 'funnels/src/library.ts'), 'utf8');
  const fields = [...library.matchAll(/field: '([a-zA-Z0-9.]+)'/g)].map((m) => m[1]!);
  return [...new Set(fields)].filter((p) => p !== 'event.type');
}

describe('the details a condition can check', () => {
  it('reads the resolvers (the scan is not empty)', () => {
    expect(resolvedPaths().size).toBeGreaterThan(100);
    expect(goalPaths().length).toBeGreaterThan(3);
  });

  it('offers only details the server fills, so a rule can come true', () => {
    const resolved = resolvedPaths();
    const dead = CONDITION_FIELDS.map((f) => f.path).filter((p) => !resolved.has(p));
    expect(dead, 'offered, but no resolver fills it').toEqual([]);
  });

  it('offers every detail a campaign goal checks', () => {
    const offered = new Set(CONDITION_FIELDS.map((f) => f.path));
    const missing = goalPaths().filter((p) => !offered.has(p));
    expect(missing, 'a library goal checks it, and the picker cannot show it').toEqual([]);
  });

  it('names each detail in words, not code', () => {
    for (const f of CONDITION_FIELDS) {
      const label = conditionFieldLabel(f.path);
      expect(label, f.path).not.toMatch(/\.|[a-z][A-Z]|_/);
      for (const c of f.choices ?? []) expect(c.label, `${f.path} = ${c.value}`).not.toMatch(/_/);
    }
    expect(conditionFieldLabel('booking.status')).toBe('Booking · Status');
  });

  it('keeps a stored detail it does not offer, under its own name', () => {
    const items = conditionFieldItems('deal.search');
    expect(items.at(-1)).toEqual({ value: 'deal.search', label: 'deal.search' });
    expect(
      conditionFieldItems('booking.status').filter((i) => i.value === 'booking.status')
    ).toHaveLength(1);
  });

  it('finds a detail by the words an owner types for the goal they want', () => {
    const found = (query: string) =>
      conditionFieldItems('')
        .filter((item) => conditionFieldMatches(item, query))
        .map((item) => item.value);
    expect(found('paid')).toContain('order.paymentStatus');
    expect(found('booked')).toContain('booking.status');
    expect(found('book')).toContain('booking.status');
    expect(found('confirmed')).toContain('booking.status');
    expect(found('accepted')).toContain('quote.stageName');
    expect(found('order payment')).toEqual(['order.paymentStatus']);
    expect(found('zebra')).toEqual([]);
  });

  it('offers comparisons that fit, and keeps a stored one that does not', () => {
    expect(operatorsFor('booking.status', 'eq')).not.toContain('gt');
    expect(operatorsFor('booking.status', 'gt')).toContain('gt');
    expect(operatorsFor('customer.hasOrdered', 'eq')).toEqual(['eq']);
  });
});
