// Build the segment-rule projection for a single customer.
//
// The shape mirrors the @wizeworks/crm-schemas CustomerProjection (used by the
// rule editor's autocomplete). One tenant-scoped transaction loads the
// customer, its trade account (by id) and its email-engagement counts; the result feeds
// evaluateSegmentRule. Keeping the builder centralized means there's one
// place to add a new addressable field — segment rules, evaluator, and
// dashboard preview-count all see it at the same time.

import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';
import type { RuleProjection } from '@wizeworks/crm-schemas';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import { asBag } from '../services/custom-properties';
import { tierInEffect } from '../services/company-service';

/** Opens and clicks in the last 30 days, the two `email.*` counts a rule reads. */
export interface EmailEngagement {
  opened: number;
  clicked: number;
}

const ENGAGEMENT_WINDOW_MS = 30 * 24 * 3600 * 1000;

/**
 * Email engagement per customer, in ONE grouped read.
 *
 * `customerIds` narrows it to those people; left out, it covers every customer
 * of the tenant, which is what the full recompute wants. It used to be two
 * counts per customer inside the recompute's loop: 74 `CrmActivity.count` for
 * 37 customers on a single nightly run. A customer with no row in the result
 * opened and clicked nothing.
 */
export async function countEmailEngagement(
  tx: Prisma.TransactionClient,
  customerIds?: string[]
): Promise<Map<string, EmailEngagement>> {
  const since = new Date(Date.now() - ENGAGEMENT_WINDOW_MS);
  const rows = await tx.crmActivity.groupBy({
    by: ['customerId', 'type'],
    where: {
      customerId: customerIds ? { in: customerIds } : { not: null },
      type: { in: ['email.opened', 'email.clicked'] },
      occurredAt: { gte: since },
    },
    _count: { _all: true },
  });
  const byCustomer = new Map<string, EmailEngagement>();
  for (const row of rows) {
    if (!row.customerId) continue;
    const entry = byCustomer.get(row.customerId) ?? { opened: 0, clicked: 0 };
    if (row.type === 'email.opened') entry.opened = row._count._all;
    else entry.clicked = row._count._all;
    byCustomer.set(row.customerId, entry);
  }
  return byCustomer;
}

/** `prefetched.engagement` is the full recompute's tenant-wide read; without it
 *  the projection reads this one customer's engagement itself. */
export async function buildSegmentRuleProjection(
  ctx: ServiceContext,
  customerId: string,
  prefetched: { engagement?: ReadonlyMap<string, EmailEngagement> } = {}
): Promise<RuleProjection> {
  return withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (customer?.deletedAt != null || !customer) {
      throw new CrmNotFoundError('Customer', customerId);
    }

    // The trade account, read by its id and NEVER joined as `customer.company`.
    // The Prisma client publishes a computed `company` on every customer (the
    // employer they typed, see packages/db/src/client.ts) and it SHADOWS the
    // relation: the include was accepted, ran, and handed back that string, so
    // every `b2bAccount.*` rule (price tier, credit used, fleet size, terms) read
    // undefined off a string and matched nobody. `pnpm check:shadowed` fails on
    // the join now.
    //
    // The tier's NAME rides along: a rule on `b2bAccount.pricingTier` means the
    // tier the account is really on, the one that prices its orders. It read the
    // legacy free-text column, empty on every account set up from the tiers
    // screen, so "price tier is Fleet" matched nobody (sparx persona issue 086).
    const linked = customer.companyId
      ? await tx.company.findUnique({
          where: { id: customer.companyId },
          include: { pricingTierFk: { select: { name: true, deletedAt: true } } },
        })
      : null;
    // A removed account trades on nothing, so it is no account here, the same
    // way a removed tier is no tier below.
    const account = linked?.deletedAt == null ? linked : null;

    const engagement = prefetched.engagement ?? (await countEmailEngagement(tx, [customerId]));
    const { opened, clicked } = engagement.get(customerId) ?? { opened: 0, clicked: 0 };

    const now = Date.now();
    const daysSinceLastOrder = customer.lastOrderAt
      ? Math.floor((now - customer.lastOrderAt.getTime()) / 86_400_000)
      : null;
    // Never null: everyone has a day they were added. That is the point of it —
    // "new customers" has to mean everyone who joined recently, including the
    // ones who have not bought anything.
    const daysSinceCreated = Math.floor((now - customer.createdAt.getTime()) / 86_400_000);

    // Marketing-subscribed = holds marketing consent AND isn't do-not-contact.
    // Reads the gdpr_consent JSON the signup/checkout opt-in writes (docs/51 §7).
    const consent = (customer.gdprConsent ?? {}) as { scope?: unknown };
    const hasMarketingConsent = Array.isArray(consent.scope) && consent.scope.includes('marketing');
    const subscribed = hasMarketingConsent && !customer.doNotContact;

    const b2bUtilization = account
      ? Number(account.creditLimit) > 0
        ? Number(account.creditUsed) / Number(account.creditLimit)
        : 0
      : 0;

    return {
      customer: {
        id: customer.id,
        type: customer.type,
        lifecycleStage: customer.lifecycleStage,
        leadStatus: customer.leadStatus,
        email: customer.email,
        tags: customer.tags ?? [],
        company: customer.companyName,
        createdAt: customer.createdAt,
        daysSinceCreated,
        totalSpent: Number(customer.totalSpent),
        orderCount: customer.orderCount,
        firstOrderAt: customer.firstOrderAt,
        lastOrderAt: customer.lastOrderAt,
        daysSinceLastOrder,
        assignedRepId: customer.assignedRepId,
        doNotContact: customer.doNotContact,
        b2bAccountId: customer.companyId,
      },
      b2bAccount: account
        ? {
            // A removed tier prices nothing, so it is no tier here. A segment
            // picks the tier by id, which survives a rename; the name is kept
            // for a rule saved on it (sparx persona issue 149).
            pricingTierId: tierInEffect(account.pricingTierFk) ? account.pricingTierId : null,
            pricingTier: tierInEffect(account.pricingTierFk)?.name ?? null,
            creditUtilization: b2bUtilization,
            fleetSize: account.fleetSize,
            status: account.status,
            paymentTerms: account.paymentTerms,
          }
        : null,
      email: {
        openedLast30d: opened,
        clickedLast30d: clicked,
        unsubscribed: customer.doNotContact,
        subscribed,
      },
      // Tenant-declared properties (docs/144 §3.4), so a rule can say
      // `custom.contact.warrantyExpires` alongside `customer.totalSpent`. The
      // bags are read straight off the rows already loaded above: the account's
      // comes with the account read, so this costs no extra query.
      //
      // `deal` is deliberately absent: a customer can be on several deals, and
      // "which one does the rule mean?" has no single answer. Deal properties
      // become reachable through a labelled association once Phase 2 lands.
      custom: {
        contact: asBag(customer.customProperties),
        company: account ? asBag(account.customProperties) : undefined,
      },
    };
  });
}
