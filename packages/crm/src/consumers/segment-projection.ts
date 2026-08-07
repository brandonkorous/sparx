// Build the segment-rule projection for a single customer.
//
// The shape mirrors the @sparx/crm-schemas CustomerProjection (used by the
// rule editor's autocomplete). One tenant-scoped query loads customer +
// B2B account + email-engagement counts; the result feeds
// evaluateSegmentRule. Keeping the builder centralized means there's one
// place to add a new addressable field — segment rules, evaluator, and
// dashboard preview-count all see it at the same time.

import { withTenant } from '@sparx/db';
import type { RuleProjection } from '@sparx/crm-schemas';

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
        b2bAccount: true,
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

    // Marketing-subscribed = holds marketing consent AND isn't do-not-contact.
    // Reads the gdpr_consent JSON the signup/checkout opt-in writes (docs/51 §7).
    const consent = (customer.gdprConsent ?? {}) as { scope?: unknown };
    const hasMarketingConsent = Array.isArray(consent.scope) && consent.scope.includes('marketing');
    const subscribed = hasMarketingConsent && !customer.doNotContact;

    const b2bUtilization = customer.b2bAccount
      ? Number(customer.b2bAccount.creditLimit) > 0
        ? Number(customer.b2bAccount.creditUsed) / Number(customer.b2bAccount.creditLimit)
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
        company: customer.company,
        createdAt: customer.createdAt,
        totalSpent: Number(customer.totalSpent),
        orderCount: customer.orderCount,
        firstOrderAt: customer.firstOrderAt,
        lastOrderAt: customer.lastOrderAt,
        daysSinceLastOrder,
        assignedRepId: customer.assignedRepId,
        doNotContact: customer.doNotContact,
        b2bAccountId: customer.b2bAccountId,
      },
      b2bAccount: customer.b2bAccount
        ? {
            pricingTier: customer.b2bAccount.pricingTier,
            creditUtilization: b2bUtilization,
            fleetSize: customer.b2bAccount.fleetSize,
            status: customer.b2bAccount.status,
            paymentTerms: customer.b2bAccount.paymentTerms,
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
      // comes free with the b2bAccount include, so this costs no extra query.
      //
      // `deal` is deliberately absent: a customer can be on several deals, and
      // "which one does the rule mean?" has no single answer. Deal properties
      // become reachable through a labelled association once Phase 2 lands.
      custom: {
        contact: asBag(customer.customProperties),
        company: customer.b2bAccount ? asBag(customer.b2bAccount.customProperties) : undefined,
      },
    };
  });
}
