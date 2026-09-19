// Guard for the OTHER half of the create/update pair, next to
// patch-semantics.test.ts, which guards what a patch may fabricate.
//
// A form's blank <select> or cleared date sends `null`, not a missing key. So a
// create schema and its update schema have to accept the same nulls, or the
// identical payload saves on an existing record and 400s on a new one — with an
// error naming fields nobody touched.
//
// Real damage this caught: `CreatePoApprovalRuleInput` rejected null on
// supplierId, warehouseId, requiredApproverUserId and requiredRole while the
// update accepted all four. The Spending limits form opens on "Any supplier ·
// Any location", which is exactly that payload, so its DEFAULT state was
// unsaveable and the only way through was to narrow the limit to one supplier at
// one location. MEASURED 2026-09-18: zero rows in `inventory_po_approval_rules`
// across every tenant on the platform, and therefore zero purchase orders ever
// held for sign-off. The whole surface existed and could not be switched on.
//
// The purchase-order form sends the same shape and does NOT break, because its
// request builder spreads each optional field conditionally — the workaround
// lived at one call site, so the schema stayed wrong and the next form to send
// an honest payload was the one that broke. That is what makes this a guard
// rather than a fix. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// Generic on purpose, like its neighbour: a pair added tomorrow is covered
// without anyone remembering this file exists.
//
// It bites where drift is POSSIBLE. 39 of the 48 patch schemas here are built as
// `Create….partial()`, so narrowing the create narrows the patch with it and the
// two can never disagree — which is itself the better fix, and is what closed
// the approval-rule pair: deleting the patch's duplicated `.nullable()` lines
// left them inherited. The 9 declared independently are the ones this walks
// meaningfully, and `CreateBundleInput.fixedPriceCents` is the field the guard
// was proved red against.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import * as schemas from './index';

// Fields whose create schema still refuses a null its update accepts. It is
// EMPTY, and the guard is what keeps it that way.
//
// MEASURED 2026-09-18: 23 such fields across 36 create/update pairs when this
// was written. All 23 are now widened to `.nullable()`/`.nullish()`, which is
// safe by construction rather than by judgment — the patch already accepted
// null on the same field, so the column takes it, and the create service's own
// `?? null` maps an explicit null to the write it already performs when the key
// is absent.
//
// If a create genuinely must refuse a null its patch accepts, add it here with
// the reason. Nothing qualifies today.
const KNOWN_DIVERGENT = new Set<string>([]);

/** The ZodObject inside whatever wrapping (`.refine`, `.default`, …) it carries. */
function objectOf(schema: unknown): z.ZodObject<z.ZodRawShape> | null {
  let current = schema;
  for (let depth = 0; depth < 8; depth += 1) {
    if (current instanceof z.ZodObject) return current;
    const def = (current as { _def?: { schema?: unknown; innerType?: unknown } })._def;
    if (!def) return null;
    current = def.schema ?? def.innerType;
    if (current === undefined || current === null) return null;
  }
  return null;
}

interface Pair {
  createName: string;
  create: z.ZodType;
  update: z.ZodType;
}

function pairs(): Pair[] {
  const all = Object.entries(schemas) as [string, unknown][];
  const found: Pair[] = [];
  for (const [name, update] of all) {
    if (!/^Update[A-Za-z0-9]*Input$/.test(name)) continue;
    if (!(update instanceof z.ZodType)) continue;
    const createName = name.replace(/^Update/, 'Create');
    const create = (schemas as Record<string, unknown>)[createName];
    if (!(create instanceof z.ZodType)) continue;
    found.push({ createName, create, update });
  }
  return found.sort((a, b) => a.createName.localeCompare(b.createName));
}

function divergentFields(pair: Pair): string[] {
  const create = objectOf(pair.create);
  const update = objectOf(pair.update);
  if (!create || !update) return [];
  const out: string[] = [];
  for (const key of Object.keys(update.shape)) {
    const createField = create.shape[key];
    if (!createField) continue;
    const updateTakesNull = (update.shape[key] as z.ZodType).safeParse(null).success;
    const createTakesNull = (createField as z.ZodType).safeParse(null).success;
    if (updateTakesNull && !createTakesNull) out.push(`${pair.createName}.${key}`);
  }
  return out;
}

describe('a create schema accepts the nulls its update accepts', () => {
  it('finds the create/update pairs to check', () => {
    expect(pairs().length).toBeGreaterThan(30);
  });

  it.each(pairs())('$createName matches its patch', (pair: Pair) => {
    for (const field of divergentFields(pair)) {
      expect(
        KNOWN_DIVERGENT.has(field),
        `${field} rejects null but the patch accepts it. A blank <select> sends null, ` +
          `so this field saves when editing and 400s when creating. Widen it to ` +
          `.nullable().optional() — or, if the create genuinely must refuse null, add it to ` +
          `KNOWN_DIVERGENT with the reason.`
      ).toBe(true);
    }
  });

  it('is not carrying exemptions that have been fixed', () => {
    const live = new Set(pairs().flatMap(divergentFields));
    const stale = [...KNOWN_DIVERGENT].filter((field) => !live.has(field));
    expect(stale, 'These are fixed. Delete them from KNOWN_DIVERGENT.').toEqual([]);
  });

  it('holds the count at zero', () => {
    // A number rather than a vibe. It was 23; the whole class is closed, so the
    // only honest floor is none at all.
    expect(pairs().flatMap(divergentFields)).toEqual([]);
  });
});
