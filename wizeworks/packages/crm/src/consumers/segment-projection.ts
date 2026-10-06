// Build the segment-rule projection for a single customer.
//
// The shape mirrors the @wizeworks/crm-schemas CustomerProjection (used by the
// rule editor's autocomplete). One tenant-scoped transaction loads the
// customer, its trade account (by id) and its email-engagement counts; the result feeds
// evaluateSegmentRule. Keeping the builder centralized means there's one
// place to add a new addressable field — segment rules, evaluator, and
// dashboard preview-count all see it at the same time.

import { withTenant } from '@wizeworks/db';
import type { RuleProjection } from '@wizeworks/crm-schemas';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import { asBag } from '../services/custom-properties';
import { tierInEffect } from '../services/company-service';

export async function buildSegmentRuleProjection(
  ctx: ServiceContext,
  customerId: string
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

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [opened, clicked] = await Promise.all([
      tx.crmActivity.count({
        where: { customerId, type: 'email.opened', occurredAt: { gte: since } },
      }),
      tx.crmActivity.count({
        where: { customerId, type: 'email.clicked', occurredAt: { gte: since } },
      }),
    ]);

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
            // A removed tier prices nothing, so it is no tier here.
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
