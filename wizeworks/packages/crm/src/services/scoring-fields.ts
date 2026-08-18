// The vocabulary scoring rules are written against (docs/144 §10).
//
// ══════════════════════════════════════════════════════════════════════════
// THE PATHS ARE THE AUTOMATION ENGINE'S PATHS, DELIBERATELY
// ══════════════════════════════════════════════════════════════════════════
//
// `customer.totalSpent`, `deal.stageType`, `customer.daysSinceLastOrder` — the
// same dotted names the automation resolvers expose, because a person who learned
// them writing a rule should not have to learn a second set to write a score. The
// two field sets are maintained together on purpose; the exhaustive-vocabulary
// test in `scoring.test.ts` is what keeps that promise from quietly lapsing.
//
// WHY THIS ISN'T JUST CALLING THE ENGINE'S RESOLVERS. Those hydrate under a
// `TenantCtx` carrying a publisher and a logger — the machinery an EFFECT needs.
// Scoring produces no effect: it reads a record and computes a number. Taking the
// whole engine as a dependency to reach two `findUnique` calls would invert the
// package graph (`@wizeworks/automation` deliberately knows nothing about the CRM) to
// save about sixty lines.
//
// This file also carries fields the engine's resolvers DON'T, because scoring
// asks questions automations never had to: how long a deal has sat in its current
// stage, how recently someone engaged. Those are the questions a score is made of.

import type { ResolvedFields } from '@wizeworks/automation-schemas';
import type { TxClient } from '@wizeworks/db';

const MS_PER_DAY = 86_400_000;

/** Prisma Decimal | number | null → number | null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function daysSince(then: Date | null | undefined, now: Date): number | null {
  if (!then) return null;
  return Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
}

/** One entry in the field catalog the rule editor offers. */
export interface ScoringField {
  path: string;
  label: string;
  kind: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'list';
}

/**
 * What can be asked about a contact.
 *
 * Written as a hand-maintained list rather than derived from the projection,
 * because the LABEL is the product: "How much they've spent with you" is what a
 * business owner recognises, and `customer.totalSpent` is not.
 */
export const CONTACT_SCORING_FIELDS: readonly ScoringField[] = [
  { path: 'customer.lifecycleStage', label: 'Where they are in the journey', kind: 'text' },
  { path: 'customer.leadStatus', label: 'How the follow-up is going', kind: 'text' },
  { path: 'customer.type', label: 'What kind of customer they are', kind: 'text' },
  { path: 'customer.company', label: 'The company they work for', kind: 'text' },
  { path: 'customer.jobTitle', label: 'Their job title', kind: 'text' },
  { path: 'customer.tags', label: 'Their labels', kind: 'list' },
  { path: 'customer.hasOrdered', label: 'They have bought something', kind: 'boolean' },
  { path: 'customer.orderCount', label: 'How many times they have bought', kind: 'number' },
  { path: 'customer.totalSpent', label: "How much they've spent with you", kind: 'currency' },
  { path: 'customer.daysSinceLastOrder', label: 'Days since their last order', kind: 'number' },
  { path: 'customer.daysSinceCreated', label: 'Days since you added them', kind: 'number' },
  { path: 'customer.doNotContact', label: 'They asked not to be contacted', kind: 'boolean' },
  { path: 'customer.hasEmail', label: 'You have an email address for them', kind: 'boolean' },
  { path: 'customer.hasPhone', label: 'You have a phone number for them', kind: 'boolean' },
  // The engagement counters — the ones a lead score is mostly made of, and the
  // reason this file exists rather than reusing the engine's customer resolver.
  { path: 'customer.emailOpens30d', label: 'Emails opened in the last 30 days', kind: 'number' },
  { path: 'customer.emailClicks30d', label: 'Links clicked in the last 30 days', kind: 'number' },
  { path: 'customer.activities30d', label: 'Interactions in the last 30 days', kind: 'number' },
  {
    path: 'customer.daysSinceActivity',
    label: 'Days since they last did anything',
    kind: 'number',
  },
  { path: 'customer.openDeals', label: 'Open opportunities they are on', kind: 'number' },
];

/** What can be asked about a deal. */
export const DEAL_SCORING_FIELDS: readonly ScoringField[] = [
  { path: 'deal.value', label: 'What the deal is worth', kind: 'currency' },
  { path: 'deal.probability', label: 'How likely you think it is', kind: 'number' },
  { path: 'deal.stageType', label: 'Open, won or lost', kind: 'text' },
  { path: 'deal.stageId', label: 'Which stage it sits on', kind: 'text' },
  { path: 'deal.source', label: 'Where it came from', kind: 'text' },
  { path: 'deal.tags', label: 'Its labels', kind: 'list' },
  { path: 'deal.isClosed', label: 'It has been closed', kind: 'boolean' },
  { path: 'deal.hasOwner', label: 'Someone is responsible for it', kind: 'boolean' },
  { path: 'deal.daysOpen', label: 'Days since it was created', kind: 'number' },
  { path: 'deal.daysInStage', label: 'Days sitting on its current stage', kind: 'number' },
  { path: 'deal.daysToExpectedClose', label: 'Days until the expected close date', kind: 'number' },
  { path: 'deal.isOverdue', label: 'Past its expected close date', kind: 'boolean' },
  { path: 'deal.activities30d', label: 'Interactions in the last 30 days', kind: 'number' },
  { path: 'deal.daysSinceActivity', label: 'Days since anything happened on it', kind: 'number' },
];

export function scoringFieldsFor(objectKey: string): readonly ScoringField[] {
  if (objectKey === 'contact') return CONTACT_SCORING_FIELDS;
  if (objectKey === 'deal') return DEAL_SCORING_FIELDS;
  return [];
}

/**
 * Hydrate one contact into the flat field map its rules evaluate against.
 *
 * Returns null when the record is gone or soft-deleted — the caller skips it
 * rather than scoring a ghost to zero, which would look like a real change and
 * write a real score event.
 */
export async function contactScoringFields(
  tx: TxClient,
  customerId: string,
  now: Date
): Promise<ResolvedFields | null> {
  const c = await tx.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    select: {
      id: true,
      type: true,
      lifecycleStage: true,
      leadStatus: true,
      email: true,
      phone: true,
      companyName: true,
      jobTitle: true,
      doNotContact: true,
      tags: true,
      totalSpent: true,
      orderCount: true,
      lastOrderAt: true,
      createdAt: true,
    },
  });
  if (!c) return null;

  const since30 = new Date(now.getTime() - 30 * MS_PER_DAY);

  // Three counts in one round trip. Grouping by activity type would be one query
  // instead of three, but it returns rows-per-type that then need reassembling in
  // JS for two of the three answers — this reads as what it computes.
  const [opens, clicks, activities, lastActivity, openDeals] = await Promise.all([
    tx.crmActivity.count({
      where: { customerId, type: 'email.opened', occurredAt: { gte: since30 } },
    }),
    tx.crmActivity.count({
      where: { customerId, type: 'email.clicked', occurredAt: { gte: since30 } },
    }),
    tx.crmActivity.count({ where: { customerId, occurredAt: { gte: since30 } } }),
    tx.crmActivity.findFirst({
      where: { customerId },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    }),
    tx.deal.count({ where: { customerId, closedAt: null, deletedAt: null } }),
  ]);

  return {
    'customer.id': c.id,
    'customer.type': c.type,
    'customer.lifecycleStage': c.lifecycleStage,
    'customer.leadStatus': c.leadStatus,
    'customer.company': c.companyName,
    'customer.jobTitle': c.jobTitle,
    'customer.tags': c.tags,
    'customer.doNotContact': c.doNotContact,
    'customer.hasEmail': Boolean(c.email),
    'customer.hasPhone': Boolean(c.phone),
    'customer.orderCount': c.orderCount,
    'customer.hasOrdered': c.orderCount > 0,
    'customer.totalSpent': num(c.totalSpent),
    'customer.daysSinceLastOrder': daysSince(c.lastOrderAt, now),
    'customer.daysSinceCreated': daysSince(c.createdAt, now),
    'customer.emailOpens30d': opens,
    'customer.emailClicks30d': clicks,
    'customer.activities30d': activities,
    'customer.daysSinceActivity': daysSince(lastActivity?.occurredAt ?? null, now),
    'customer.openDeals': openDeals,
  };
}

/** Hydrate one deal. Null when it is gone or soft-deleted. */
export async function dealScoringFields(
  tx: TxClient,
  dealId: string,
  now: Date
): Promise<ResolvedFields | null> {
  const d = await tx.deal.findFirst({
    where: { id: dealId, deletedAt: null },
    select: {
      id: true,
      value: true,
      probability: true,
      stageId: true,
      source: true,
      tags: true,
      assignedRepId: true,
      closedAt: true,
      expectedCloseDate: true,
      createdAt: true,
      stage: { select: { stageType: true } },
    },
  });
  if (!d) return null;

  const since30 = new Date(now.getTime() - 30 * MS_PER_DAY);

  const [activities, lastActivity, lastStageMove] = await Promise.all([
    tx.crmActivity.count({ where: { dealId, occurredAt: { gte: since30 } } }),
    tx.crmActivity.findFirst({
      where: { dealId },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    }),
    // How long it has sat where it is. Read from the stage-change activity rather
    // than a column, because `updated_at` moves on every edit — renaming a deal
    // would reset "days in stage" to zero, which is the one thing that number
    // must not do.
    tx.crmActivity.findFirst({
      // All three types are stage moves — `deal-service.moveStage` names the
      // won/lost transitions after their outcome rather than after the move.
      // Matching only `deal.stage.changed` would report a deal that closed
      // yesterday as having sat in its stage since it was created.
      where: { dealId, type: { in: ['deal.stage.changed', 'deal.closed', 'deal.lost'] } },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    }),
  ]);

  const expected = d.expectedCloseDate;
  const daysToExpected =
    expected === null ? null : Math.floor((expected.getTime() - now.getTime()) / MS_PER_DAY);

  return {
    'deal.id': d.id,
    'deal.value': num(d.value),
    'deal.probability': num(d.probability),
    'deal.stageId': d.stageId,
    'deal.stageType': d.stage.stageType,
    'deal.source': d.source,
    'deal.tags': d.tags,
    'deal.isClosed': d.closedAt !== null,
    'deal.hasOwner': d.assignedRepId !== null,
    'deal.daysOpen': daysSince(d.createdAt, now),
    // Falls back to the deal's own age when it has never moved — a deal created
    // on stage one has genuinely been in that stage since it was created.
    'deal.daysInStage': daysSince(lastStageMove?.occurredAt ?? d.createdAt, now),
    'deal.daysToExpectedClose': daysToExpected,
    'deal.isOverdue': daysToExpected !== null && daysToExpected < 0 && d.closedAt === null,
    'deal.activities30d': activities,
    'deal.daysSinceActivity': daysSince(lastActivity?.occurredAt ?? null, now),
  };
}

/** Dispatch by object key. Returns null for an object with no projection — the
 *  caller treats that as "not scoreable" rather than "scores zero". */
export async function scoringFieldsForRecord(
  tx: TxClient,
  objectKey: string,
  recordId: string,
  now: Date
): Promise<ResolvedFields | null> {
  if (objectKey === 'contact') return contactScoringFields(tx, recordId, now);
  if (objectKey === 'deal') return dealScoringFields(tx, recordId, now);
  return null;
}
