// Partner commission payouts via Stripe Connect (docs/114 §B.4). Reuses the same
// platform Stripe client + Express-account + Account-Link pattern as sparx Pay
// onboarding (payments-onboarding.ts), but for the OTHER direction: a partner
// RECEIVES monthly commission transfers from the platform balance.
//
//   • onboarding — mint a partner Express account (partners.stripePayoutAccountId)
//     + a hosted Account Link; Stripe hosts KYC/bank (Stripe-hosted-first).
//   • the run — group each partner's `approved` commissions ≥ their threshold,
//     create ONE transfer to their connected account, record a payout_run, and
//     mark the commissions paid. Idempotent-ish + best-effort per partner.

import { getPlatformStripe } from '@sparx/payments';
import { withSystem, withTenant } from '@sparx/db';
import { appOrigin } from '@sparx/links/server';
import { PaymentsUnconfiguredError } from '../payments-onboarding.js';

import { formatPartnerMoney, publishPartnerEmail, publishPartnerEvent } from './events.js';

/** Ensure the partner has a Stripe Express connected account for payouts, creating
 *  one on first use + persisting its id on the partner row. Idempotent. */
async function ensurePayoutAccount(partnerTenantId: string): Promise<string> {
  const stripe = getPlatformStripe();
  if (!stripe) throw new PaymentsUnconfiguredError();

  const existing = await withTenant({ tenantId: partnerTenantId }, (tx) =>
    tx.partner.findUnique({
      where: { tenantId: partnerTenantId },
      select: { stripePayoutAccountId: true },
    })
  );
  if (existing?.stripePayoutAccountId) return existing.stripePayoutAccountId;

  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: { transfers: { requested: true } },
    metadata: { sparx_partner_tenant_id: partnerTenantId },
  });
  await withTenant({ tenantId: partnerTenantId }, (tx) =>
    tx.partner.update({
      where: { tenantId: partnerTenantId },
      data: { stripePayoutAccountId: account.id },
    })
  );
  return account.id;
}

/** Start (or resume) hosted payout onboarding for the current partner. */
export async function startPayoutOnboarding(args: {
  partnerTenantId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string; accountId: string }> {
  const stripe = getPlatformStripe();
  if (!stripe) throw new PaymentsUnconfiguredError();
  const accountId = await ensurePayoutAccount(args.partnerTenantId);
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: args.refreshUrl,
    return_url: args.returnUrl,
    type: 'account_onboarding',
  });
  return { url: link.url, accountId };
}

export interface PayoutRunSummary {
  partnersPaid: number;
  totalCents: number;
  skipped: number;
}

/** The monthly payout batch (docs/114 §B.4). For every active partner with a
 *  connected payout account, sum their `approved` commissions; if the total meets
 *  their threshold, transfer it from the platform balance to their account and
 *  mark those commissions paid under one payout_run. Best-effort per partner. */
export async function runPayouts(now: Date): Promise<PayoutRunSummary> {
  const stripe = getPlatformStripe();
  if (!stripe) throw new PaymentsUnconfiguredError();

  // Active partners with a payout account are visible under withSystem
  // (partners_visibility exposes status='active').
  const partners = await withSystem((tx) =>
    tx.partner.findMany({
      where: { status: 'active', stripePayoutAccountId: { not: null }, deletedAt: null },
      select: { id: true, tenantId: true, stripePayoutAccountId: true, payoutMinCents: true },
    })
  );

  const summary: PayoutRunSummary = { partnersPaid: 0, totalCents: 0, skipped: 0 };
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const partner of partners) {
    const accountId = partner.stripePayoutAccountId;
    if (!accountId) continue;
    try {
      const due = await withTenant({ tenantId: partner.tenantId }, (tx) =>
        tx.partnerCommission.findMany({
          where: { tenantId: partner.tenantId, status: 'approved' },
          select: { id: true, amountCents: true, currency: true },
        })
      );
      const totalCents = due.reduce((s, c) => s + c.amountCents, 0);
      if (due.length === 0 || totalCents < partner.payoutMinCents) {
        summary.skipped += 1;
        continue;
      }
      const currency = (due[0]?.currency ?? 'USD').toLowerCase();

      const transfer = await stripe.transfers.create({
        amount: totalCents,
        currency,
        destination: accountId,
        metadata: {
          sparx_partner_id: partner.id,
          sparx_period: `${now.getFullYear()}-${now.getMonth() + 1}`,
        },
      });

      await withTenant({ tenantId: partner.tenantId }, async (tx) => {
        const runRow = await tx.partnerPayoutRun.create({
          data: {
            tenantId: partner.tenantId,
            partnerId: partner.id,
            periodStart,
            periodEnd: now,
            amountCents: totalCents,
            currency: currency.toUpperCase(),
            commissionCount: due.length,
            status: 'paid',
            stripeTransferId: transfer.id,
            paidAt: now,
          },
          select: { id: true },
        });
        await tx.partnerCommission.updateMany({
          where: { id: { in: due.map((c) => c.id) } },
          data: {
            status: 'paid',
            payoutRunId: runRow.id,
            stripeTransferId: transfer.id,
            paidAt: now,
          },
        });
      });

      await publishPartnerEvent('partner.payout.paid', partner.tenantId, null, {
        partnerId: partner.id,
        amountCents: totalCents,
        transferId: transfer.id,
      });
      // Tell the partner their payout is on the way (contact = Tenant.email).
      const payoutContact = await withSystem((tx) =>
        tx.tenant.findUnique({
          where: { id: partner.tenantId },
          select: { email: true, name: true },
        })
      );
      if (payoutContact?.email) {
        await publishPartnerEmail(partner.tenantId, null, {
          to: payoutContact.email,
          template: 'partner-earnings',
          props: {
            kind: 'payout',
            partnerName: payoutContact.name ?? undefined,
            amountLabel: formatPartnerMoney(totalCents, currency),
            dashboardUrl: appOrigin(),
          },
        });
      }
      summary.partnersPaid += 1;
      summary.totalCents += totalCents;
    } catch (err) {
      // One partner's failure (KYC incomplete, insufficient balance) must not
      // block the rest — log + skip. A retry next run picks it up.
      summary.skipped += 1;
      console.error('partner payout failed', { partnerId: partner.id, err });
    }
  }
  return summary;
}

/** Approve pending commissions (docs/114 §B.4) so the next run can pay them. A
 *  commission is held `pending` until the referred org's payment window clears
 *  (no clawback risk); this promotes eligible ones to `approved`. */
export async function approvePendingCommissions(): Promise<{ approved: number }> {
  const partners = await withSystem((tx) =>
    tx.partner.findMany({
      where: { status: 'active', deletedAt: null },
      select: { tenantId: true },
    })
  );
  let approved = 0;
  for (const p of partners) {
    const res = await withTenant({ tenantId: p.tenantId }, (tx) =>
      tx.partnerCommission.updateMany({
        where: { tenantId: p.tenantId, status: 'pending' },
        data: { status: 'approved' },
      })
    );
    approved += res.count;
  }
  return { approved };
}
