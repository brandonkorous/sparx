// b2bQuoteRequestService: a trade buyer's quote request while they are still
// putting it together, and the moment it becomes a quote (sparx persona issue 086).
//
// The /b2b page promised "From the catalog, the buyer builds a request
// (quantities, delivery needs, notes) and submits it. It lands in your
// dashboard, separate from the cart." The only way in was one form on the
// Quotes page, typed in one sitting, with no delivery needs and no PO number.
//
// THE VISIBILITY RULE. A request being built lives in `b2b_quote_requests`, not
// as a draft quote, and no staff screen reads that table. A quote is a
// BillingDocument on the `b2b-quotes` workflow; creating one publishes
// `crm.billing_document.created` (automations trigger on it), mints a Q-
// number and lists it in the staff queue, all of which tell the business about
// something the buyer has not sent. So the business sees nothing until the
// buyer presses Send, and then sees it at Submitted, exactly as a request typed
// in one sitting always landed. (The staff's own unfinished Draft quotes are a
// different thing: those are the business's working copies.)
//
// The request is the ACCOUNT's: one open request per account (a partial unique
// index enforces it), shared by every contact who can order, from any device.
// Every read and write here is scoped by the account id it is handed, and the
// route hands only an account the signed-in contact belongs to.

import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';
import { PoNumber, withDeliveryNeeds, type DeliveryNeeds } from '@wizeworks/crm-schemas';

import { CrmValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import * as b2bQuoteService from './b2b-quote-service';
import * as billingDocumentService from './billing-document-service';
import * as billingDocumentStageService from './billing-document-stage-service';
import * as billingLineService from './billing-line-service';

type Tx = Prisma.TransactionClient;

/** The most lines one request carries, the same cap a request sent in one go has. */
export const QUOTE_REQUEST_LINE_LIMIT = 50;

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const QuoteRequestLineInput = z
  .object({
    variantId: z.string().uuid().nullable().optional(),
    description: z.string().trim().max(500).optional(),
    quantity: z.number().int().positive().max(99_999),
  })
  .refine((l) => Boolean(l.variantId) || Boolean(l.description), {
    message: 'Say what you need, or pick it from the catalog.',
    path: ['description'],
  });
export type QuoteRequestLineInput = z.infer<typeof QuoteRequestLineInput>;

export const SaveQuoteRequestInput = z.object({
  neededBy: z.string().regex(CALENDAR_DAY, 'Choose the day you need it by.').nullable().optional(),
  deliverTo: z.string().trim().max(1000).nullable().optional(),
  deliveryNotes: z.string().trim().max(2000).nullable().optional(),
  poNumber: PoNumber.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z
    .array(QuoteRequestLineInput)
    .max(
      QUOTE_REQUEST_LINE_LIMIT,
      `A request can carry ${QUOTE_REQUEST_LINE_LIMIT} items. Send this one and start another.`
    ),
});
export type SaveQuoteRequestInput = z.infer<typeof SaveQuoteRequestInput>;

/** Who is acting, and for which account. The route has already checked the
 *  contact belongs to the account and may order on it. */
export interface QuoteRequestActor {
  accountId: string;
  customerId: string;
}

export interface QuoteRequestLineView {
  id: string;
  variantId: string | null;
  description: string;
  quantity: number;
}

export interface QuoteRequestView {
  id: string;
  /** `YYYY-MM-DD`, or null. */
  neededBy: string | null;
  deliverTo: string | null;
  deliveryNotes: string | null;
  poNumber: string | null;
  notes: string | null;
  /** The contact who started it, by name, or null when they have left. */
  startedBy: string | null;
  updatedAt: string;
  lines: QuoteRequestLineView[];
}

/** The account's open request, and only that account's. */
export function openRequestWhere(accountId: string) {
  return { companyId: accountId, status: 'open' } as const;
}

const REQUEST_INCLUDE = {
  lines: { orderBy: { position: 'asc' } },
  startedBy: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.B2bQuoteRequestInclude;

type RequestRow = Prisma.B2bQuoteRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

/**
 * A `@db.Date` column as the calendar day it is, `YYYY-MM-DD`.
 *
 * Prisma hands a date-only column back as midnight UTC on that day, so the UTC
 * fields ARE the stored day. Sending it as a full timestamp would make a reader
 * west of UTC draw the day before. Same rule as `calendarDate` in
 * `@wizeworks/inventory`, which this package cannot import.
 */
function calendarDayOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function toView(row: RequestRow): QuoteRequestView {
  const who = row.startedBy;
  const full = who ? [who.firstName, who.lastName].filter(Boolean).join(' ').trim() : '';
  const name = full !== '' ? full : (who?.email ?? null);
  return {
    id: row.id,
    neededBy: calendarDayOrNull(row.neededBy),
    deliverTo: row.deliverTo,
    deliveryNotes: row.deliveryNotes,
    poNumber: row.poNumber,
    notes: row.notes,
    startedBy: name,
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      description: l.description,
      quantity: l.quantity,
    })),
  };
}

function loadOpen(tx: Tx, accountId: string): Promise<RequestRow | null> {
  return tx.b2bQuoteRequest.findFirst({
    where: openRequestWhere(accountId),
    include: REQUEST_INCLUDE,
  });
}

/** The account's open request, starting one when there is none. Two contacts
 *  starting at once both land on the same row: the insert skips on the partial
 *  unique index rather than failing the transaction. */
async function openOrStart(tx: Tx, ctx: ServiceContext, actor: QuoteRequestActor) {
  const existing = await loadOpen(tx, actor.accountId);
  if (existing) return existing;
  await tx.b2bQuoteRequest.createMany({
    data: [
      {
        tenantId: ctx.tenantId,
        companyId: actor.accountId,
        startedByCustomerId: actor.customerId,
      },
    ],
    skipDuplicates: true,
  });
  const started = await loadOpen(tx, actor.accountId);
  if (!started) throw new Error('b2b quote request: the open request could not be started');
  return started;
}

/** How the catalog names an item, or a refusal when the shop no longer sells it. */
async function catalogDescription(tx: Tx, variantId: string): Promise<string> {
  const variant = await tx.productVariant.findFirst({
    where: {
      id: variantId,
      deletedAt: null,
      product: { deletedAt: null, status: 'active' },
    },
    select: { title: true, product: { select: { title: true } } },
  });
  if (!variant) {
    throw new CrmValidationError('That item is no longer sold, so it cannot be added.', [
      { field: 'variantId', message: 'No longer sold.' },
    ]);
  }
  const option = variant.title?.trim();
  return option && option !== 'Default' && option !== 'Default Title'
    ? `${variant.product.title}, ${option}`
    : variant.product.title;
}

export async function getOpen(
  ctx: ServiceContext,
  accountId: string
): Promise<QuoteRequestView | null> {
  return withTenant(ctx, async (tx) => {
    const row = await loadOpen(tx, accountId);
    return row ? toView(row) : null;
  });
}

/** "Add to quote request" from a product page: more of the same item is more
 *  on its line, never a second line. */
export async function addItem(
  ctx: ServiceContext,
  actor: QuoteRequestActor,
  rawLine: unknown
): Promise<QuoteRequestView> {
  const line = QuoteRequestLineInput.parse(rawLine);
  return withTenant(ctx, async (tx) => {
    const description = line.variantId
      ? await catalogDescription(tx, line.variantId)
      : (line.description ?? '');
    const request = await openOrStart(tx, ctx, actor);

    const same = line.variantId
      ? request.lines.find((l) => l.variantId === line.variantId)
      : undefined;
    if (same) {
      await tx.b2bQuoteRequestLine.update({
        where: { id: same.id },
        data: { quantity: same.quantity + line.quantity },
      });
    } else {
      if (request.lines.length >= QUOTE_REQUEST_LINE_LIMIT) {
        throw new CrmValidationError(
          `This request already has ${QUOTE_REQUEST_LINE_LIMIT} items. Send it and start another.`
        );
      }
      await tx.b2bQuoteRequestLine.create({
        data: {
          tenantId: ctx.tenantId,
          requestId: request.id,
          variantId: line.variantId ?? null,
          description,
          quantity: line.quantity,
          position: request.lines.reduce((max, l) => Math.max(max, l.position + 1), 0),
        },
      });
    }
    // Touch the request so "last changed" means the last change.
    await tx.b2bQuoteRequest.update({ where: { id: request.id }, data: {} });

    const after = await loadOpen(tx, actor.accountId);
    if (!after) throw new Error('b2b quote request: lost the open request');
    return toView(after);
  });
}

/** Save the whole request from the Quotes page: its lines as listed, and its
 *  delivery needs, PO number and notes. */
export async function save(
  ctx: ServiceContext,
  actor: QuoteRequestActor,
  rawInput: unknown
): Promise<QuoteRequestView> {
  const input = SaveQuoteRequestInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    // A catalog line is named as the catalog names it, checked BEFORE anything
    // is written so a refusal leaves the request as it was. A line whose item
    // has since left the catalog keeps the words it already carries.
    const lines: { variantId: string | null; description: string; quantity: number }[] = [];
    for (const l of input.lines) {
      if (l.variantId) {
        lines.push({
          variantId: l.variantId,
          description: await catalogDescription(tx, l.variantId),
          quantity: l.quantity,
        });
      } else {
        lines.push({ variantId: null, description: l.description ?? '', quantity: l.quantity });
      }
    }

    const request = await openOrStart(tx, ctx, actor);
    await tx.b2bQuoteRequestLine.deleteMany({ where: { requestId: request.id } });
    if (lines.length > 0) {
      await tx.b2bQuoteRequestLine.createMany({
        data: lines.map((l, position) => ({
          tenantId: ctx.tenantId,
          requestId: request.id,
          ...l,
          position,
        })),
      });
    }
    await tx.b2bQuoteRequest.update({
      where: { id: request.id },
      data: {
        ...(input.neededBy !== undefined
          ? { neededBy: input.neededBy ? new Date(`${input.neededBy}T00:00:00.000Z`) : null }
          : {}),
        ...(input.deliverTo !== undefined ? { deliverTo: blankToNull(input.deliverTo) } : {}),
        ...(input.deliveryNotes !== undefined
          ? { deliveryNotes: blankToNull(input.deliveryNotes) }
          : {}),
        ...(input.poNumber !== undefined ? { poNumber: blankToNull(input.poNumber) } : {}),
        ...(input.notes !== undefined ? { notes: blankToNull(input.notes) } : {}),
      },
    });

    const after = await loadOpen(tx, actor.accountId);
    if (!after) throw new Error('b2b quote request: lost the open request');
    return toView(after);
  });
}

/** Throw the account's unsent request away. Nothing the business has seen. */
export async function discard(ctx: ServiceContext, accountId: string): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.b2bQuoteRequest.deleteMany({ where: openRequestWhere(accountId) })
  );
}

export interface RequestedQuoteInput {
  customerId: string;
  accountId: string;
  customerNote: string | null;
  poNumber: string | null;
  delivery: DeliveryNeeds;
  lines: { variantId: string | null; description: string; quantity: number }[];
}

/**
 * What one account pays for one item, as checkout and the console's quote
 * editor work it out (`pricingService.resolveForAccount`, the engine behind
 * `/v1/b2b/resolve-price`), and the sentence saying why ("Fleet price: 12% off
 * $400.00"), null when it is the list price. Handed in by the caller because the
 * price engine lives in the commerce package, which depends on this one.
 */
export type AccountPricer = (query: {
  variantId: string;
  accountId: string;
  quantity: number;
  propertyId: string | null;
}) => Promise<{ unitPrice: number; priceNote: string | null }>;

export interface RequestedQuoteOptions {
  /** Starts each catalog line at the account's price. Without it, or when it
   *  fails for a line, the line starts at the list price. */
  accountPrice?: AccountPricer;
}

/** The note and product name a catalog line keeps in its metadata, the same
 *  keys the console quote editor writes (`withPriceNote`, `withProductLabel`). */
function catalogLineMetadata(
  priceNote: string | null,
  productLabel: string | null
): Record<string, unknown> {
  return {
    ...(priceNote && priceNote.trim() !== '' ? { priceNote } : {}),
    ...(productLabel && productLabel.trim() !== '' ? { productLabel } : {}),
  };
}

/**
 * Make the quote a request becomes: a document on the `b2b-quotes` workflow
 * with the requested lines, advanced straight to "Submitted" so it lands in the
 * business's queue. Each catalog line starts at the ACCOUNT's price with the
 * note saying why, as a quote typed in the console does (sparx persona issue
 * 086, after 077): Renée's request was stored at list, $2,832.00 where her Fleet
 * group pays $2,492.00. The buyer does not see these prices until the business
 * has priced the quote and sent it (the portal hides them before "Quoted"). The one path both a built-up request and
 * a request sent in one go take, so both carry the PO number (where the quote's
 * PO already lives, `metadata.poNumber`, which rides onto the order and the
 * invoice) and the delivery needs (`metadata.delivery`).
 *
 * If a line cannot be written, the half-made quote is removed rather than left
 * sitting in Draft, and the failure is thrown for the caller to report.
 */
export async function createRequestedQuote(
  ctx: ServiceContext,
  input: RequestedQuoteInput,
  options: RequestedQuoteOptions = {}
): Promise<{ id: string; number: string | null }> {
  const { draftStage, submittedStage } = await withTenant(ctx, async (tx) => ({
    draftStage: await b2bQuoteService.b2bQuoteDraftStage(tx, ctx.tenantId),
    submittedStage: await b2bQuoteService.b2bQuoteStageByName(tx, ctx.tenantId, 'Submitted'),
  }));

  const created = await billingDocumentService.create(ctx, {
    workflowId: draftStage.workflowId,
    stageId: draftStage.id,
    customerId: input.customerId,
    companyId: input.accountId,
    poNumber: input.poNumber,
    metadata: withDeliveryNeeds({}, input.delivery),
    ...(input.customerNote ? { customerNote: input.customerNote } : {}),
  });

  try {
    // Which product each catalog line draws from, and its name, as the
    // console editor links and labels a line picked from the catalog.
    const variantIds = input.lines
      .map((l) => l.variantId)
      .filter((id): id is string => id !== null);
    const products = new Map(
      variantIds.length === 0
        ? []
        : (
            await withTenant(ctx, (tx) =>
              tx.productVariant.findMany({
                where: { id: { in: variantIds } },
                select: { id: true, productId: true, product: { select: { title: true } } },
              })
            )
          ).map((v) => [v.id, { productId: v.productId, title: v.product.title }])
    );

    // A product-linked line uses the `catalog` line type: a price given wins
    // and the line keeps the item's cost for its margin; with none it starts
    // at the item's list price. A typed line has nothing to price it from and
    // passes `unitPrice: 0`, since `addLine`'s default `flat` pricing needs one;
    // the business prices it while responding.
    for (const line of input.lines) {
      if (!line.variantId) {
        await billingLineService.addLine(ctx, created.id, {
          description: line.description,
          quantity: line.quantity,
          unitPrice: 0,
        });
        continue;
      }
      const product = products.get(line.variantId) ?? null;
      const priced = options.accountPrice
        ? await options
            .accountPrice({
              variantId: line.variantId,
              accountId: input.accountId,
              quantity: line.quantity,
              propertyId: created.propertyId ?? null,
            })
            // Not knowing the account's price is no reason to refuse the
            // request: the line starts at list, as it always did, and the
            // business prices it.
            .catch(() => null)
        : null;
      await billingLineService.addLine(ctx, created.id, {
        description: line.description,
        quantity: line.quantity,
        variantId: line.variantId,
        ...(product ? { productId: product.productId } : {}),
        lineTypeKey: 'catalog',
        ...(priced ? { unitPrice: priced.unitPrice } : {}),
        metadata: catalogLineMetadata(priced?.priceNote ?? null, product?.title ?? null),
      });
    }
    const doc = await billingDocumentStageService.advance(ctx, created.id, {
      stageId: submittedStage.id,
    });
    return { id: doc.id, number: doc.number };
  } catch (err) {
    await billingDocumentService.remove(ctx, created.id).catch(() => undefined);
    throw err;
  }
}

/**
 * Send the account's request. It is CLAIMED first (open to submitted in one
 * conditional write), so two contacts pressing Send at once make one quote, not
 * two. If the quote cannot be made the claim is undone and the request stays
 * open, as it was, for them to send again.
 */
export async function submit(
  ctx: ServiceContext,
  actor: QuoteRequestActor,
  options: RequestedQuoteOptions = {}
): Promise<{ id: string; number: string | null }> {
  const claimed = await withTenant(ctx, async (tx) => {
    const request = await loadOpen(tx, actor.accountId);
    if (!request || request.lines.length === 0) return null;
    const won = await tx.b2bQuoteRequest.updateMany({
      where: { id: request.id, ...openRequestWhere(actor.accountId) },
      data: { status: 'submitted', submittedAt: new Date() },
    });
    return won.count === 1 ? request : null;
  });
  if (!claimed) {
    throw new CrmValidationError('There is nothing in this request to send yet.');
  }

  try {
    const quote = await createRequestedQuote(
      ctx,
      {
        customerId: actor.customerId,
        accountId: actor.accountId,
        customerNote: claimed.notes,
        poNumber: claimed.poNumber,
        delivery: {
          neededBy: calendarDayOrNull(claimed.neededBy),
          deliverTo: claimed.deliverTo,
          notes: claimed.deliveryNotes,
        },
        lines: claimed.lines.map((l) => ({
          variantId: l.variantId,
          description: l.description,
          quantity: l.quantity,
        })),
      },
      options
    );
    await withTenant(ctx, (tx) =>
      tx.b2bQuoteRequest.update({
        where: { id: claimed.id },
        data: { submittedDocumentId: quote.id },
      })
    );
    return quote;
  } catch (err) {
    await withTenant(ctx, (tx) =>
      tx.b2bQuoteRequest.updateMany({
        where: { id: claimed.id, companyId: actor.accountId, status: 'submitted' },
        data: { status: 'open', submittedAt: null },
      })
    );
    throw err;
  }
}
