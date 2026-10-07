// The email that gives a customer their invoice or quote: who it is to, and
// everything the `invoice-sent` template needs to show it.
//
// ── WHY IT LIVES HERE ───────────────────────────────────────────────────────
//
// It was built inside api-rest's `sendInvoice`, the one place a document was
// sent: the business pressing Send. An invoice issued on an account's terms
// when an order is placed is never sent by a person, so it was never sent at
// all. MEASURED 2026-10-02 on Gillett Diesel: three order invoices, INV-000001,
// -003 and -005, every one "Not sent yet", under a /b2b page promising "orders
// on terms invoice automatically with the buyer's PO number" (sparx persona
// issue 085). The automation that now sends them runs in a worker, so the
// builder moved here, where the Send button and the automation share it: one
// invoice email, whichever way it leaves.
//
// It builds and does not send. The transport stays with each caller, which is
// why this package still has no dependency on one.

import { withTenant } from '@wizeworks/db';
import { resolveSiteOrigin, siteUrl } from '@wizeworks/db/site-origin';
import { paymentTermsOf, paymentTermsWords, poNumberOf } from '@wizeworks/crm-schemas';
import { billingDocumentNoun, isPriceOfferWorkflow } from '@wizeworks/crm-schemas/builtins';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { documentRecipient } from './account-contact-billing';
import { dueDateFromTerms } from './billing-document-stage-service';

/** The money figures a bill is built from, in major units. */
export interface InvoiceMoney {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  surchargeTotal: number;
  /** Refundable core deposits on rebuilt parts (sparx issue 051). */
  coreChargeTotal: number;
  amountPaid: number;
}

/**
 * THE ROWS THE CUSTOMER ADDS UP.
 *
 * Only the rows that are TRUE of this document: a "Tax $0.00" line on a bakery
 * that charges no tax is a number nobody set, and "Already paid" on an untouched
 * invoice says a payment happened.
 *
 * But every row that IS true has to be here, and delivery and surcharge were
 * not. A bill whose lines added to $58, whose subtotal said $58, asked the
 * customer for $67 and explained none of it. Nine dollars from nowhere is a
 * document nobody can check: the customer who checks has to write and ask, and
 * the one who does not pays a charge they were never shown. The PRINTED invoice
 * had both rows from the start, which is why this went unnoticed: the one
 * artifact that got it right is the one nobody reads on screen.
 *
 * The invariant, and what its test asserts: subtotal - discount + tax + delivery
 * + surcharge - already paid == the balance the email asks for.
 */
export function invoiceSummaryRows(
  m: InvoiceMoney,
  currency: string
): { label: string; value: string }[] {
  const rows = [{ label: 'Subtotal', value: money(m.subtotal, currency) }];
  if (m.discountTotal > 0) {
    rows.push({ label: 'Discount', value: `-${money(m.discountTotal, currency)}` });
  }
  if (m.taxTotal > 0) rows.push({ label: 'Tax', value: money(m.taxTotal, currency) });
  if (m.shippingTotal > 0) {
    rows.push({ label: 'Delivery', value: money(m.shippingTotal, currency) });
  }
  if (m.surchargeTotal > 0) {
    rows.push({ label: 'Surcharge', value: money(m.surchargeTotal, currency) });
  }
  if (m.coreChargeTotal > 0) {
    rows.push({ label: 'Refundable core deposits', value: money(m.coreChargeTotal, currency) });
  }
  if (m.amountPaid > 0) {
    rows.push({ label: 'Already paid', value: `-${money(m.amountPaid, currency)}` });
  }
  return rows;
}

/** The trading name frozen on the document when it was finalized, or null.
 *  `siteName`, not `legalName`: this is the name on the email a customer opens,
 *  and the shop is what they recognise. The printed document uses the legal
 *  entity. */
function frozenIssuerName(issuedBy: unknown): string | null {
  if (!issuedBy || typeof issuedBy !== 'object' || Array.isArray(issuedBy)) return null;
  const value = (issuedBy as Record<string, unknown>).siteName;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** "48 × $8.50": the arithmetic behind the line, so a bookkeeper can check it
 *  without opening anything. */
function quantityLine(quantity: number, unitPrice: number, currency: string): string {
  return `${String(quantity)} × ${money(unitPrice, currency)}`;
}

/** Where a trade buyer opens this document to print or save it as a PDF, or
 *  null for a document with no trade account (there is no account page to open
 *  it on). Pure, so the address can be tested without a database. */
export function documentViewPath(document: {
  id: string;
  companyId: string | null;
}): string | null {
  return document.companyId ? `/account/b2b/${document.companyId}/documents/${document.id}` : null;
}

/** Everything one send of the `invoice-sent` email needs. */
export interface BillingDocumentEmail {
  to: string;
  documentNumber: string;
  propertyId: string | null;
  /** The due date this send settles on, when the document had none: written
   *  back by `markBillingDocumentSent` so the document and the email agree. */
  newDueAt: Date | null;
  /** The `invoice-sent` template's props. */
  props: Record<string, unknown>;
}

/**
 * Build the email for a document, or refuse with the reason.
 *
 * Refuses rather than guesses in the two cases where a send would be a lie: a
 * document with no address to send to, and one that has not been numbered yet
 * (an unnumbered draft has nothing the customer could quote back).
 */
export async function billingDocumentEmail(
  ctx: ServiceContext,
  documentId: string,
  now: Date = new Date()
): Promise<BillingDocumentEmail> {
  return withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({
      where: { id: documentId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        stage: { select: { customerLabel: true } },
        // Which KIND of document this is. A quote and an invoice are the same
        // row on two different workflows, and the stage cannot tell them apart:
        // on `invoice` its customerLabel is the document's NAME ("Invoice",
        // "Receipt"), on `b2b-quotes` it is the offer's STANDING ("Draft",
        // "Accepted"). Only the workflow answers the question (issue 764).
        workflow: { select: { slug: true } },
        customer: { select: { email: true } },
      },
    });
    if (!doc) throw new CrmNotFoundError('BillingDocument', documentId);

    // An OFFER of a price, or a DEMAND for money? Everything below that reads as
    // billing language turns on this one answer.
    const priceOffer = isPriceOfferWorkflow(doc.workflow.slug);
    const noun = billingDocumentNoun(doc.workflow.slug);

    const billTo = (doc.billTo ?? {}) as { name?: string; email?: string };
    // Frozen Bill to, else the customer, else the account's own people: the
    // one rule the page shows too (`documentRecipient`, sparx persona issue 100).
    const to = await documentRecipient(tx, {
      billTo: doc.billTo,
      companyId: doc.companyId,
      customerEmail: doc.customer?.email ?? null,
    });
    if (!to) {
      throw new CrmValidationError(
        'There is no email address to send this to. Add one under Bill to, then send it again.'
      );
    }
    if (!doc.number) {
      throw new CrmValidationError(
        `This ${noun} has no number yet, so there is nothing for the customer to quote back. Move it to a stage that numbers it first.`
      );
    }

    // WHEN TO PAY, on the bill that asks for the money: the customer has the
    // document NOW, so this is the moment to answer it. A payer on terms already
    // has a date from stage entry and keeps it; a date set by hand always wins.
    // AND ONLY ON A BILL. A quote asks for nothing and runs OUT (`validUntil`),
    // which is the business's own choice and is never invented here (issue 765).
    const dueAt = priceOffer ? null : (doc.dueAt ?? (await dueDateFromTerms(tx, doc, now)));

    // WHO THIS IS FROM, as it was when the document was issued. The frozen name
    // wins; the live lookup is for a document with nothing frozen yet.
    const frozenName = frozenIssuerName(doc.issuedBy);
    const site =
      frozenName === null && doc.propertyId
        ? await tx.property.findUnique({ where: { id: doc.propertyId }, select: { name: true } })
        : null;
    const tenant =
      frozenName === null
        ? await tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } })
        : null;
    const fromName = frozenName ?? site?.name ?? tenant?.name ?? 'us';

    // Where the buyer opens it to print or keep as a PDF (sparx persona issue
    // 085): the /b2b page promises a quote they can keep, and an email body is
    // not one. Only a trade account has a page to open it on.
    const path = documentViewPath(doc);
    const viewUrl = path
      ? siteUrl(await resolveSiteOrigin(tx, ctx.tenantId, doc.propertyId), path)
      : null;

    const currency = doc.currency;
    return {
      to,
      documentNumber: doc.number,
      propertyId: doc.propertyId ?? null,
      newDueAt: dueAt !== null && doc.dueAt === null ? dueAt : null,
      props: {
        // Left out rather than `undefined`: the automation queues these props as
        // JSON, which cannot hold an undefined.
        ...(billTo.name ? { billToName: billTo.name } : {}),
        fromName,
        // On a BILL, the tenant's own word for this stage: "Invoice", "Bill",
        // "Statement". On a price offer the stage label is the offer's STANDING,
        // so the noun comes from the workflow (issue 765).
        documentLabel: priceOffer
          ? noun.charAt(0).toUpperCase() + noun.slice(1)
          : doc.stage.customerLabel || 'Invoice',
        priceOffer,
        documentNumber: doc.number,
        total: Number(doc.total),
        balance: Number(doc.balance),
        currency,
        dueAt: dueAt?.toISOString() ?? null,
        validUntil: doc.validUntil?.toISOString() ?? null,
        // The buyer's own purchase order number, so their accounts department
        // can match this to the order they raised (issue 077).
        poNumber: poNumberOf(doc.metadata),
        // The terms the bill was issued on, beside its due date (issue 103).
        paymentTerms: priceOffer ? null : paymentTermsWords(paymentTermsOf(doc.metadata)),
        viewUrl,
        // A rebuilt part's core deposit as its own row under the part (sparx 051).
        lines: doc.lines.flatMap((line) => {
          const part = {
            title: line.description,
            subtitle: quantityLine(Number(line.quantity), Number(line.unitPrice), currency),
            amount: money(Number(line.lineTotal), currency),
          };
          if (line.coreCharge === null) return [part];
          const core = Number(line.coreCharge);
          return [
            part,
            {
              title: `Refundable core deposit: ${line.description}`,
              subtitle: quantityLine(Number(line.quantity), core, currency),
              amount: money(core * Number(line.quantity), currency),
            },
          ];
        }),
        summary: invoiceSummaryRows(
          {
            subtotal: Number(doc.subtotal),
            discountTotal: Number(doc.discountTotal),
            taxTotal: Number(doc.taxTotal),
            shippingTotal: Number(doc.shippingTotal),
            surchargeTotal: Number(doc.surchargeTotal),
            coreChargeTotal: Number(doc.coreChargeTotal),
            amountPaid: Number(doc.amountPaid),
          },
          currency
        ),
        note: doc.notes,
      },
    };
  });
}

/**
 * Remember that it went, and to where. There is no `sent_at` column on this
 * model, so it rides in the document's own metadata bag, merged, never
 * replaced. Called after the send is handed over, so a mail that fails leaves
 * the document exactly as it was.
 */
export async function markBillingDocumentSent(
  ctx: ServiceContext,
  documentId: string,
  sent: { to: string; newDueAt: Date | null },
  now: Date = new Date()
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({
      where: { id: documentId },
      select: { metadata: true },
    });
    const metadata = (doc?.metadata ?? {}) as Record<string, unknown>;
    await tx.billingDocument.update({
      where: { id: documentId },
      data: {
        metadata: { ...metadata, sentAt: now.toISOString(), sentTo: sent.to },
        ...(sent.newDueAt !== null ? { dueAt: sent.newDueAt } : {}),
      },
    });
  });
}
