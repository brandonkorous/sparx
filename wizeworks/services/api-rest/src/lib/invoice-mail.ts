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
// There is no public invoice page (the payment-link route says so in its own
// comment) and the event path carries no attachment, so a mail that only
// ANNOUNCED an invoice would announce something the recipient cannot open.
// Everything needed to check it — who it is from, the number, the lines, the
// total, what is still owed, when it is due, and the note — is in the mail.
//
// Same placement rationale as `signature-mail.ts`: this lives in api-rest, not
// in @wizeworks/crm, because the composition root already owns the outbound
// path and giving the CRM package a transport dependency would be paid for in
// every unit test in it.

import type { FastifyRequest } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { requireAuth } from '@wizeworks/api-core/auth';
import { publish } from '@wizeworks/api-core/pubsub';

export class InvoiceSendError extends Error {}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** "48 × $8.50" — the arithmetic behind the line, so a bookkeeper can check it
 *  without opening anything. Whole quantities lose their trailing zeros; 2.5
 *  hours keeps its half. */
function quantityLine(quantity: number, unitPrice: number, currency: string): string {
  const qty = Number.isInteger(quantity) ? String(quantity) : String(quantity);
  return `${qty} × ${money(unitPrice, currency)}`;
}

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
  const doc = await withTenant({ tenantId: auth.tenantId }, (tx) =>
    tx.billingDocument.findUnique({
      where: { id: documentId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        stage: { select: { customerLabel: true } },
        customer: { select: { email: true, firstName: true, lastName: true } },
      },
    })
  );
  if (!doc) throw new InvoiceSendError('That invoice no longer exists.');

  const billTo = (doc.billTo ?? {}) as { name?: string; email?: string };
  const to = billTo.email ?? doc.customer?.email ?? null;
  if (!to) {
    throw new InvoiceSendError(
      'There is no email address to send this to. Add one under Bill to, then send it again.'
    );
  }
  if (!doc.number) {
    throw new InvoiceSendError(
      'This document has no number yet, so there is nothing for the customer to quote back. Move it to a stage that numbers it first.'
    );
  }

  // The BUSINESS's name, not ours and not the tenant's billing container: the
  // site is the business a customer deals with (docs/58). Falls back to the
  // tenant only when the document belongs to no site.
  const site = doc.propertyId
    ? await prisma.property.findUnique({ where: { id: doc.propertyId }, select: { name: true } })
    : null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { name: true },
  });
  const fromName = site?.name ?? tenant?.name ?? 'us';

  const currency = doc.currency;
  const total = Number(doc.total);
  const balance = Number(doc.balance);
  const paid = Number(doc.amountPaid);

  // Only the rows that are TRUE of this document. A "Tax $0.00" line on a
  // bakery that charges no tax is a number nobody set, and "Already paid" on an
  // untouched invoice says a payment happened.
  const summary: { label: string; value: string }[] = [
    { label: 'Subtotal', value: money(Number(doc.subtotal), currency) },
  ];
  if (Number(doc.taxTotal) > 0) {
    summary.push({ label: 'Tax', value: money(Number(doc.taxTotal), currency) });
  }
  if (paid > 0) summary.push({ label: 'Already paid', value: `-${money(paid, currency)}` });

  await publish(request.log, 'email.send', auth.tenantId, auth.actorId, {
    to,
    template: 'invoice-sent',
    propertyId: doc.propertyId ?? null,
    props: {
      billToName: billTo.name ?? undefined,
      fromName,
      // The tenant's own word for this stage — "Invoice", "Bill", "Statement".
      documentLabel: doc.stage.customerLabel || 'Invoice',
      documentNumber: doc.number,
      total,
      balance,
      currency,
      dueAt: doc.dueAt ? doc.dueAt.toISOString() : null,
      lines: doc.lines.map((line) => ({
        title: line.description,
        subtitle: quantityLine(Number(line.quantity), Number(line.unitPrice), currency),
        amount: money(Number(line.lineTotal), currency),
      })),
      summary,
      note: doc.notes,
    },
  });

  // Remember that it went, and to where. There is no `sent_at` column on this
  // model, so it rides in the document's own metadata bag — merged, never
  // replaced, because other keys live there too.
  const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
  await withTenant({ tenantId: auth.tenantId }, (tx) =>
    tx.billingDocument.update({
      where: { id: documentId },
      data: {
        metadata: { ...metadata, sentAt: new Date().toISOString(), sentTo: to },
      },
    })
  );

  return { to, documentNumber: doc.number };
}
