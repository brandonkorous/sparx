// Sending an invoice to the person who owes the money.
//
// ── WHY THIS EXISTED NOWHERE ────────────────────────────────────────────────
//
// Invoicing could create, number, total, snapshot, print and take payment on a
// document — and had no way to give it to the customer. The editor even labels
// the email box "Where the invoice gets sent", a promise nothing kept: the only
// outbound actions were "Print or save as PDF" and "Copy payment link", both of
// which hand the job back to the operator's own mail client.
//
// ── WHY THE DOCUMENT TRAVELS IN THE BODY ────────────────────────────────────
//
// The event path carries no attachment, and only a trade buyer has an account
// page to open the document on (sparx persona issue 085), so a mail that only
// ANNOUNCED an invoice would announce something most recipients cannot open.
// Everything needed to check it (who it is from, the number, the lines, the
// total, what is still owed, when it is due, and the note) is in the mail, and
// a trade buyer also gets a button to open it to print or save as a PDF.
//
// The email itself is BUILT in @wizeworks/crm (`billingDocumentMail`), because
// an invoice issued on an account's terms is emailed by an automation in a
// worker, not by this button, and the two have to send the same email (sparx
// persona issue 085). This file keeps what only the button has: the signed-in
// person, the shop's sender headers, and the immediate publish. The CRM package
// still has no transport dependency.

import type { FastifyRequest } from 'fastify';
import { requireAuth } from '@wizeworks/api-core/auth';
import { publish } from '@wizeworks/api-core/pubsub';
import { billingDocumentMail, CrmValidationError } from '@wizeworks/crm';
import { tenantSenderHeaders } from './tenant-email.js';

export class InvoiceSendError extends Error {}

// Re-exported for the callers and the test that already read them from here.
export const invoiceSummaryRows = billingDocumentMail.invoiceSummaryRows;
export type InvoiceMoney = billingDocumentMail.InvoiceMoney;

export interface SendInvoiceResult {
  to: string;
  documentNumber: string;
}

/**
 * Email the document to whoever it bills.
 *
 * Refuses rather than guesses in the two cases where a send would be a lie:
 * a document with no recipient address, and one that has not been numbered yet
 * (an unnumbered draft has nothing the customer could quote back).
 */
export async function sendInvoice(
  request: FastifyRequest,
  documentId: string
): Promise<SendInvoiceResult> {
  const auth = requireAuth(request);
  const ctx = { tenantId: auth.tenantId };
  let email: billingDocumentMail.BillingDocumentEmail;
  try {
    email = await billingDocumentMail.billingDocumentEmail(ctx, documentId);
  } catch (err) {
    if (err instanceof CrmValidationError) throw new InvoiceSendError(err.message);
    throw err;
  }

  // From the shop, with replies to the shop: the body ends "Reply to this email
  // and it goes straight to" the business, and with no sender on the event that
  // reply went to the platform's no-reply box (sparx persona issue 071).
  const sender = await tenantSenderHeaders(auth.tenantId, email.propertyId);

  await publish(request.log, 'email.send', auth.tenantId, auth.actorId, {
    to: email.to,
    template: 'invoice-sent',
    from: sender.from,
    ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
    propertyId: email.propertyId,
    props: email.props,
  });

  // Remember that it went, and to where; written after the publish so a mail
  // that fails leaves the document exactly as it was.
  await billingDocumentMail.markBillingDocumentSent(ctx, documentId, {
    to: email.to,
    newDueAt: email.newDueAt,
  });

  return { to: email.to, documentNumber: email.documentNumber };
}
