import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateConditions } from '@wizeworks/automation-schemas';
import type { Prisma } from '@wizeworks/db';
import { evaluateFunnelGoal } from './index';
import { FUNNEL_LIBRARY } from './library';

// Every shipped goal must come true for the event it waits for, and stay false
// for an event about the same person that is not it. The old shared goal
// (`email is_set`) failed the first half for every recipe: no event has `email`.

const PERSON = { 'customer.id': 'c1', 'customer.email': 'sam@example.com' };

/** The event each recipe is waiting for, as the automation resolvers render it. */
const SUCCESS: Record<string, Record<string, unknown>> = {
  'cart-recovery': { ...PERSON, 'order.paymentStatus': 'paid', 'customer.orderCount': 1 },
  'post-purchase': { ...PERSON, 'order.paymentStatus': 'paid', 'customer.orderCount': 2 },
  welcome: { ...PERSON, 'booking.status': 'confirmed' },
  'lead-nurture': { ...PERSON, 'customer.lifecycleStage': 'customer' },
  'win-back': { ...PERSON, 'order.paymentStatus': 'paid' },
  'quote-follow-up': { ...PERSON, 'quote.stageName': 'Accepted' },
  'booking-no-show': { ...PERSON, 'booking.status': 'requested' },
};

/** Something that happened to the same person that must NOT count. */
const NOT_YET: Record<string, Record<string, unknown>> = {
  'cart-recovery': { ...PERSON, 'order.paymentStatus': 'unpaid' },
  'post-purchase': { ...PERSON, 'order.paymentStatus': 'paid', 'customer.orderCount': 1 },
  welcome: { ...PERSON, 'booking.status': 'cancelled' },
  'lead-nurture': { ...PERSON, 'customer.lifecycleStage': 'lead' },
  'win-back': { ...PERSON, 'order.paymentStatus': 'refunded' },
  'quote-follow-up': { ...PERSON, 'quote.stageName': 'Quoted' },
  'booking-no-show': { ...PERSON, 'booking.status': 'no_show' },
};

describe('shipped campaign goals', () => {
  it.each(FUNNEL_LIBRARY.map((r) => [r.key, r] as const))('%s comes true', (key, recipe) => {
    expect(SUCCESS[key], `no success event for ${key}`).toBeDefined();
    expect(evaluateFunnelGoal({ goal: recipe.goal as Prisma.JsonValue }, SUCCESS[key]!)).toBe(true);
  });

  it.each(FUNNEL_LIBRARY.map((r) => [r.key, r] as const))('%s stays false', (key, recipe) => {
    expect(evaluateFunnelGoal({ goal: recipe.goal as Prisma.JsonValue }, NOT_YET[key]!)).toBe(
      false
    );
  });

  it('a person-only event never finishes a campaign', () => {
    for (const recipe of FUNNEL_LIBRARY) {
      expect(
        evaluateFunnelGoal({ goal: recipe.goal as Prisma.JsonValue }, PERSON),
        recipe.key
      ).toBe(false);
    }
  });
});

// Each step that is not the finish must say what puts somebody on it, and must
// come true for that thing. A step nothing can record reports 0 forever.
const STEP_EVENTS: Record<string, Record<string, unknown>> = {
  'cart-recovery:basket': { 'event.type': 'cart.abandoned' },
  'cart-recovery:checkout': { 'event.type': 'checkout.started' },
  'post-purchase:ordered': { 'event.type': 'order.paid' },
  'post-purchase:delivered': { 'event.type': 'order.delivered' },
  'post-purchase:reviewed': { 'event.type': 'review.submitted' },
  'welcome:joined': { 'event.type': 'crm.customer.subscribed' },
  'lead-nurture:enquired': { 'event.type': 'form.submitted' },
  'lead-nurture:qualified': { 'customer.lifecycleStage': 'sales_qualified_lead' },
  'lead-nurture:engaged': { 'event.type': 'crm.engagement.received' },
  'win-back:lapsed': { 'customer.hasOrdered': true, 'customer.daysSinceLastOrder': 200 },
  'quote-follow-up:requested': { 'quote.stageName': 'Submitted' },
  'quote-follow-up:sent': { 'quote.stageName': 'Quoted' },
  'booking-no-show:missed': { 'booking.status': 'no_show' },
};

describe('shipped campaign steps', () => {
  const steps = FUNNEL_LIBRARY.flatMap((r) =>
    r.stages.filter((s) => s.kind !== 'convert').map((s) => [`${r.key}:${s.key}`, s] as const)
  );

  it.each(steps)('%s says what records it, and it comes true', (id, stage) => {
    expect(stage.match?.conditions.length, `${id} has no match`).toBeGreaterThan(0);
    expect(STEP_EVENTS[id], `no sample event for ${id}`).toBeDefined();
    expect(evaluateConditions(stage.match!, STEP_EVENTS[id]!)).toBe(true);
  });

  it.each(steps)('%s is not recorded by an unrelated event', (_id, stage) => {
    expect(evaluateConditions(stage.match!, { 'event.type': 'crm.task.created' })).toBe(false);
  });
});

// The migration copies the library's steps and goals into SQL. If the library
// changes and the SQL does not, installed and new campaigns behave differently.
describe('the refresh migration', () => {
  const migrations = join(
    fileURLToPath(new URL('.', import.meta.url)),
    '../../db/prisma/migrations'
  );
  const dir = readdirSync(migrations).find((d) =>
    d.endsWith('_a_campaign_waits_for_something_that_happens')
  );

  it('writes the steps and goal the library ships, for every recipe', () => {
    expect(dir).toBeDefined();
    const sql = readFileSync(join(migrations, dir!, 'migration.sql'), 'utf8');
    for (const recipe of FUNNEL_LIBRARY) {
      const m = new RegExp(
        String.raw`\('${recipe.key}',\s*'([^']+)'::jsonb,\s*'([^']+)'::jsonb,\s*'([^']+)'::jsonb\)`
      ).exec(sql);
      expect(m, `no row for ${recipe.key}`).not.toBeNull();
      expect(JSON.parse(m![2]!), `${recipe.key} steps`).toEqual(recipe.stages);
      expect(JSON.parse(m![3]!), `${recipe.key} goal`).toEqual(recipe.goal);
    }
  });
});
