// Emailing a trade account its statement.
//
// The statement's reader is the buyer's accounts-payable clerk, so the mail
// carries what they reconcile with: what was owed at the start and the end of
// the period, how late it is, and every open invoice with OUR number beside
// THEIR purchase order number. The whole statement, with every payment in the
// period and a print button, is one click away on the shop's own site.
//
// Lives in api-rest for the reason invoice-mail.ts gives: the composition root
// owns the outbound path, so the CRM package stays free of a transport.
//
// Sent through the bus (`email.send`), never a direct send: the email worker
// renders the `account-statement` template and relays it.

import type { FastifyRequest } from 'fastify';
import { withTenant } from '@wizeworks/db';
import { requireAuth } from '@wizeworks/api-core/auth';
import { badRequest } from '@wizeworks/api-core/errors';
import { publish } from '@wizeworks/api-core/pubsub';
import {
  b2bStatementService,
  statementPeriodText,
  type AccountStatement,
  type StatementRecipient,
} from '@wizeworks/crm';
import { resolveSiteOrigin, siteUrl } from './site-origin.js';
import { tenantSenderHeaders } from './tenant-email.js';

/** The statement on the shop's own site, for the same period. The buyer signs
 *  in there and sees exactly what this email summarises, with a print button. */
export function statementPageUrl(
  origin: string,
  accountId: string,
  period: { from: string; to: string }
): string {
  const qs = new URLSearchParams({ from: period.from, to: period.to });
  return siteUrl(
    origin,
    `/account/b2b/${encodeURIComponent(accountId)}/statement?${qs.toString()}`
  );
}

/** The props the `account-statement` template reads, in major units. */
export function statementEmailProps(
  statement: AccountStatement,
  fromName: string,
  contactName: string | null,
  statementUrl: string | null
) {
  const major = (cents: number) => cents / 100;
  return {
    fromName,
    accountName: statement.account.companyName,
    contactName,
    periodText: statementPeriodText(statement.period),
    currency: statement.currency,
    opening: major(statement.openingCents),
    closing: major(statement.closingCents),
    dueNow: major(statement.dueNowCents),
    pastDue: major(statement.pastDueCents),
    aging: statement.aging.map((bucket) => ({ label: bucket.label, amount: major(bucket.cents) })),
    openInvoices: statement.openItems.map((item) => ({
      number: item.number ?? 'Invoice',
      poNumber: item.poNumber,
      dueAt: item.dueAt,
      daysLate: item.daysLate,
      amount: major(item.openCents),
    })),
    statementUrl,
  };
}

export interface SendStatementResult {
  sentTo: string[];
}

/**
 * Email the statement for a period to the account's billing contacts.
 *
 * Refuses rather than sending to nobody: an account with no email address on
 * file is told so, in a sentence that says where to add one.
 */
export async function sendAccountStatement(
  request: FastifyRequest,
  accountId: string,
  period: { from?: string | null; to?: string | null }
): Promise<SendStatementResult> {
  const auth = requireAuth(request);
  const ctx = { tenantId: auth.tenantId, userId: auth.actorId };

  const [statement, recipients] = await Promise.all([
    b2bStatementService.buildAccountStatement(ctx, { accountId, ...period }),
    b2bStatementService.statementRecipients(ctx, accountId),
  ]);
  if (recipients.length === 0) {
    throw badRequest(
      `Nobody at ${statement.account.companyName} has an email address on file, so there is ` +
        'nowhere to send this. Add an email address to one of the people on the account, then ' +
        'send it again.'
    );
  }

  // Under the name of the site that issued their most recent invoice: the shop
  // they know, on the address their invoices came from.
  const propertyId = statement.issuerPropertyId;
  const [site, tenant] = await withTenant({ tenantId: auth.tenantId }, (tx) =>
    Promise.all([
      propertyId
        ? tx.property.findUnique({ where: { id: propertyId }, select: { name: true } })
        : Promise.resolve(null),
      tx.tenant.findUnique({ where: { id: auth.tenantId }, select: { name: true } }),
    ])
  );
  const fromName = site?.name ?? tenant?.name ?? 'Your supplier';
  const origin = await resolveSiteOrigin(auth.tenantId, propertyId);
  const url = statementPageUrl(origin, accountId, statement.period);
  const sender = await tenantSenderHeaders(auth.tenantId, propertyId);

  for (const recipient of recipients) {
    await publish(request.log, 'email.send', auth.tenantId, auth.actorId, {
      to: recipient.email,
      template: 'account-statement',
      from: sender.from,
      ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
      propertyId,
      props: statementEmailProps(statement, fromName, greetingName(recipient), url),
    });
  }

  return { sentTo: recipients.map((r) => r.email) };
}

/** A person is greeted by name. An inbox known only by the company it bills
 *  ("Wasatch Front Utility Contractors, LLC") is greeted as "there". */
function greetingName(recipient: StatementRecipient): string | null {
  return recipient.reason === 'invoice_address' ? null : recipient.name;
}
