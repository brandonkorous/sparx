// Build the segment-rule projection for a single customer.
//
// The shape mirrors the @wizeworks/crm-schemas CustomerProjection (used by the
// rule editor's autocomplete). One tenant-scoped query loads customer +
// B2B account + email-engagement counts; the result feeds
// evaluateSegmentRule. Keeping the builder centralized means there's one
// place to add a new addressable field — segment rules, evaluator, and
// dashboard preview-count all see it at the same time.

import { withTenant } from '@wizeworks/db';
import type { RuleProjection } from '@wizeworks/crm-schemas';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import { asBag } from '../services/custom-properties';

export async function buildSegmentRuleProjection(
  ctx: ServiceContext,
  customerId: string
): Promise<RuleProjection> {
  return withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      include: {
        company: true,
      },
    });
    if (customer?.deletedAt != null || !customer) {
      throw new CrmNotFoundError('Customer', customerId);
    }

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

    const b2bUtilization = customer.company
      ? Number(customer.company.creditLimit) > 0
        ? Number(customer.company.creditUsed) / Number(customer.company.creditLimit)
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
      b2bAccount: customer.company
        ? {
            pricingTier: customer.company.pricingTier,
            creditUtilization: b2bUtilization,
            fleetSize: customer.company.fleetSize,
            status: customer.company.status,
            paymentTerms: customer.company.paymentTerms,
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
      // bags are read straight off the rows already loaded above — the company's
      // comes free with the company include, so this costs no extra query.
      //
      // `deal` is deliberately absent: a customer can be on several deals, and
      // "which one does the rule mean?" has no single answer. Deal properties
      // become reachable through a labelled association once Phase 2 lands.
      custom: {
        contact: asBag(customer.customProperties),
        company: customer.company ? asBag(customer.company.customProperties) : undefined,
      },
    };
  });
}
