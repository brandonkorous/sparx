// Legal-page service (docs/42 §3) — the shared logic behind the legal CHECKLIST and
// instantiating a starter template into a draft page. The REST route and the MCP tools
// both drive legal-page discovery + scaffolding through here, so the checklist state
// machine and the template→draft(+footer placement) instantiation live in ONE place —
// the same "one service, many transports" rule as entries-service.
//
// What deliberately stays OUT of this surface: PUBLISHING and the starter-text
// DISCLAIMER ACKNOWLEDGMENT. Those are a human approval gate — a caller may scaffold a
// draft, but a person reviews the starter text, acknowledges it (legal_disclaimer_ack_at),
// and takes it live. The REST route keeps those two handlers; nothing here approves legal.

import type { ContentEntry, Prisma, TxClient } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';
import { conflict } from '@wizeworks/api-core/errors';
import {
  LEGAL_TEMPLATES,
  getLegalTemplate,
  requiredLegalKinds,
  legalEntryBody,
  type LegalKind,
  type LegalTemplate,
} from '@wizeworks/legal-templates';

import { recordRevision } from './entries.js';
import type { CmsWriteContext, CmsEmittedEvent } from './service-support.js';

type Json = Prisma.InputJsonValue;

/** Where a legal template stands for this tenant: `missing` (no page), `draft` (exists
 *  but unpublished), `stale` (published on an older template version), `unplaced`
 *  (published but not in the footer), or `complete`. */
export type LegalChecklistState = 'complete' | 'missing' | 'draft' | 'stale' | 'unplaced';

export interface LegalChecklistItem {
  legalKind: LegalKind;
  title: string;
  defaultSlug: string;
  /** Privacy is always required; commerce docs (returns/shipping/refund) only when the
   *  Commerce module is on; the rest optional. */
  required: boolean;
  state: LegalChecklistState;
  entry: {
    id: string;
    slug: string | null;
    status: string;
    updatedAt: string;
    templateVersion: number | null;
    currentVersion: number;
    /** The tenant accepted the starter-text disclaimer (a human approval, not an agent). */
    acknowledged: boolean;
    /** Wired into the footer via a placement — the reason a footer legal link resolves. */
    placed: boolean;
  } | null;
  /**
   * Sentences on this page that are still the starter's guess about how this
   * business works, because the page is published and has never been edited.
   *
   * Empty when the page has been touched, when the starter asserts nothing
   * specific (privacy, terms, cookies describe the platform), or when there is no
   * page at all.
   *
   * `complete` deliberately still means complete. A published, placed,
   * current-version page IS the thing the checklist counts, and dropping it out of
   * "5 of 5 ready" over unread wording would make the count mean something else.
   * What was wrong was saying nothing at all: three of these starters state a
   * return window, a packing time and a refund time, and a number on a published
   * policy page is indistinguishable from a decision (issue 375).
   */
  stillGuessing: readonly string[];
}

export interface LegalChecklist {
  items: LegalChecklistItem[];
  completeness: { requiredTotal: number; requiredComplete: number };
  /** Whether to prompt for a shipping policy, and on what evidence. */
  shipping: ShippingPolicySignal;
}

/**
 * Whether this business actually SELLS THINGS, on evidence — the same rule the
 * shipping signal below already uses, for the same reason.
 *
 * `modules.commerce.enabled` was the old test and is not evidence. Piggles ships
 * every app switched on for everybody (no module pricing), so that flag is true
 * for a hair salon, a bookkeeper and a choir, and each of them was told a Return
 * Policy was REQUIRED before their site could count as ready. A default is not a
 * decision anybody made.
 *
 * A live product, or an order that has actually been placed, is one.
 */
async function sellsThingsTx(tx: TxClient): Promise<boolean> {
  const product = await tx.product.findFirst({
    where: { status: 'active', deletedAt: null },
    select: { id: true },
  });
  if (product) return true;
  const order = await tx.order.findFirst({ select: { id: true } });
  return order !== null;
}

/**
 * Whether this business actually POSTS THINGS TO PEOPLE, on evidence.
 *
 * The Shipping Policy is optional, because selling is not shipping — a bakery
 * taking collection orders has commerce switched on and posts nothing. But a
 * business that DOES ship and has no shipping policy should be told, so the
 * prompt has to come from evidence rather than from a default.
 *
 * `Product.requiresShipping` is NOT that evidence: it defaults to `true`, so
 * every tenant on the platform would trip it, including the collection-only
 * bakery this change exists for. A default is not a decision anybody made.
 *
 * These two are decisions somebody made:
 *
 *   `delivery-rates`  a shipping RATE exists — someone sat down and priced
 *                     delivery. Zones alone are not enough; a zone can be
 *                     seeded, a rate is authored.
 *   `orders-shipped`  an order was actually fulfilled with a carrier or a
 *                     tracking number. The strongest signal there is: it
 *                     already happened.
 *
 * `because` is carried out, not just the boolean, so the notice can say WHY it
 * is asking. "You have set delivery charges" is actionable; "you should write a
 * shipping policy" with no reason reads as nagging and gets dismissed.
 */
export type ShippingEvidence = 'delivery-rates' | 'orders-shipped';

export interface ShippingPolicySignal {
  /** Evidence says this business ships. */
  ships: boolean;
  /** What the evidence was, or null when there is none. */
  because: ShippingEvidence | null;
  /** They ship AND no shipping policy is live. The only state worth a notice. */
  missingPolicy: boolean;
}

async function shippingEvidenceTx(tx: TxClient): Promise<ShippingEvidence | null> {
  const rate = await tx.shippingRate.findFirst({ select: { id: true } });
  if (rate) return 'delivery-rates';
  const shipped = await tx.orderFulfillment.findFirst({
    where: {
      OR: [
        { status: { in: ['shipped', 'delivered'] } },
        { trackingNumber: { not: null } },
        { shippedAt: { not: null } },
      ],
    },
    select: { id: true },
  });
  return shipped ? 'orders-shipped' : null;
}

/** The legal checklist over the platform template registry: for each template, whether
 *  the tenant has a page, whether it's published, current, and placed in the footer. */
export async function getLegalChecklistTx(
  tx: TxClient,
  _tenantId: string
): Promise<LegalChecklist> {
  const required = new Set(requiredLegalKinds({ commerceEnabled: await sellsThingsTx(tx) }));

  const rows = await tx.contentEntry.findMany({
    where: { typeKey: 'page', legalKind: { not: null }, deletedAt: null },
    select: {
      id: true,
      slug: true,
      status: true,
      legalKind: true,
      legalTemplateVersion: true,
      legalDisclaimerAckAt: true,
      updatedAt: true,
      body: true,
    },
  });
  const placements = await tx.siteDocPlacement.findMany({
    where: { placement: 'footer', enabled: true, entryId: { not: null } },
    select: { entryId: true },
  });
  const placedEntryIds = new Set(placements.map((p) => p.entryId));
  const byKind = new Map(rows.map((e) => [e.legalKind, e]));

  const items: LegalChecklistItem[] = LEGAL_TEMPLATES.map((t) => {
    const entry = byKind.get(t.legalKind);
    const placed = entry ? placedEntryIds.has(entry.id) : false;
    let state: LegalChecklistState;
    if (!entry) state = 'missing';
    else if (entry.status !== 'published') state = 'draft';
    else if ((entry.legalTemplateVersion ?? 0) < t.templateVersion) state = 'stale';
    else if (!placed) state = 'unplaced';
    else state = 'complete';
    // Only worth saying about a page somebody can actually read: a draft or a
    // missing page has its own, louder row.
    const unread = entry?.status === 'published' && bodyIsStillTheStarter(entry.body, t);
    return {
      legalKind: t.legalKind,
      title: t.title,
      defaultSlug: t.defaultSlug,
      required: required.has(t.legalKind),
      state,
      stillGuessing: unread ? (t.assumes ?? []) : [],
      entry: entry
        ? {
            id: entry.id,
            slug: entry.slug,
            status: entry.status,
            updatedAt: entry.updatedAt.toISOString(),
            templateVersion: entry.legalTemplateVersion,
            currentVersion: t.templateVersion,
            acknowledged: entry.legalDisclaimerAckAt !== null,
            placed,
          }
        : null,
    };
  });

  const requiredItems = items.filter((i) => i.required);
  const because = await shippingEvidenceTx(tx);
  const shippingLive = items.find((i) => i.legalKind === 'shipping')?.state === 'complete';
  return {
    items,
    completeness: {
      requiredTotal: requiredItems.length,
      requiredComplete: requiredItems.filter((i) => i.state === 'complete').length,
    },
    shipping: {
      ships: because !== null,
      because,
      missingPolicy: because !== null && !shippingLive,
    },
  };
}

/** Tx-opening wrapper for callers with no ambient transaction (the MCP tools). */
export function getLegalChecklist(tenantId: string): Promise<LegalChecklist> {
  return withTenant({ tenantId }, (tx) => getLegalChecklistTx(tx, tenantId));
}

export interface LegalPageResult {
  entry: ContentEntry;
  events: CmsEmittedEvent[];
}

/** Instantiate a legal starter template into a DRAFT page plus a tenant-wide footer
 *  placement (propertyId null = every site). Refuses if a page of that kind — or any
 *  page already sitting at the template's default slug — exists. Draft + unacknowledged
 *  by design: the caller/human publishes and accepts the disclaimer. Returns the entry
 *  and the domain events for the caller to emit (transport owns the event bus). */
export async function createLegalPageTx(
  tx: TxClient,
  ctx: CmsWriteContext,
  legalKind: LegalKind
): Promise<LegalPageResult> {
  const template = getLegalTemplate(legalKind);
  if (!template) throw conflict(`Unknown legal template "${legalKind}".`);

  const existing = await tx.contentEntry.findFirst({
    where: { typeKey: 'page', legalKind, deletedAt: null },
    select: { id: true },
  });
  if (existing) throw conflict(`A ${template.title} page already exists.`);

  const slugClash = await tx.contentEntry.findFirst({
    where: { typeKey: 'page', slug: template.defaultSlug, deletedAt: null },
    select: { id: true },
  });
  if (slugClash) throw conflict(`A page with slug "${template.defaultSlug}" already exists.`);

  const body = legalEntryBody(template);
  const entry = await tx.contentEntry.create({
    data: {
      tenantId: ctx.tenantId,
      typeKey: 'page',
      slug: template.defaultSlug,
      status: 'draft',
      body: body as unknown as Json,
      legalKind: template.legalKind,
      legalTemplateVersion: template.templateVersion,
    },
  });

  await recordRevision(tx, {
    tenantId: ctx.tenantId,
    entryId: entry.id,
    body,
    seoJson: {},
    status: entry.status,
    kind: 'manual',
    authorId: ctx.actorId,
    summary: 'Created from legal starter template',
  });

  // Find-or-create the tenant-wide footer placement, scoped to propertyId null so a
  // site-specific placement of the same page never blocks the default one.
  const existingPlacement = await tx.siteDocPlacement.findFirst({
    where: { placement: 'footer', sourceKind: 'cms_entry', entryId: entry.id, propertyId: null },
    select: { id: true },
  });
  if (!existingPlacement) {
    const maxPos = await tx.siteDocPlacement.aggregate({
      where: { placement: 'footer' },
      _max: { position: true },
    });
    await tx.siteDocPlacement.create({
      data: {
        tenantId: ctx.tenantId,
        placement: 'footer',
        sourceKind: 'cms_entry',
        entryId: entry.id,
        legalKind: template.legalKind,
        label: template.title,
        columnKey: 'legal',
        position: (maxPos._max.position ?? -1) + 1,
      },
    });
  }

  return {
    entry,
    events: [
      {
        type: 'content.entry.created',
        data: { entryId: entry.id, typeKey: entry.typeKey, slug: entry.slug, status: entry.status },
      },
    ],
  };
}

/** Tx-opening wrapper for callers with no ambient transaction (the MCP tools). */
export function createLegalPage(
  ctx: CmsWriteContext,
  legalKind: LegalKind
): Promise<LegalPageResult> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) => createLegalPageTx(tx, ctx, legalKind));
}

// ─── Taking the newer starter wording ────────────────────────────────────────
//
// The checklist can mark a page `stale` — published, but built on starter wording
// the platform has since rewritten. NOTHING used to move it off that state.
// `legal_template_version` was written once at creation and never again, so a
// tenant whose page went stale could edit it, publish it, place it in the footer,
// and still read "a newer starter version is available" forever, with "0 of 4
// required ready" underneath it. The row said "open it to see what changed and
// update it", and the editor it opened offered neither.
//
// That is what these two do. `legalStarterUpdate` is what the screen SHOWS her —
// the actual new wording, not a description of it — and `refreshLegalPage` is
// what takes it.

export interface LegalStarterUpdate {
  legalKind: LegalKind;
  title: string;
  /** The starter version this page was built on. */
  fromVersion: number;
  /** Where the starter has got to. */
  toVersion: number;
  /** The new wording itself, so the screen can show it rather than promise it. */
  body: { title: string; body: unknown };
  /**
   * True when the page still holds exactly what the starter wrote.
   *
   * Answered from the revision history rather than by diffing against the old
   * template, because old template versions are not kept — only the current one
   * is in the code. A page with one revision (the "Created from legal starter
   * template" one) whose body still matches it has never been touched, so taking
   * the new wording costs her nothing. Anything else HAS her work in it, and the
   * screen has to say so before it offers to replace it.
   */
  unedited: boolean;
}

/**
 * Is this page still, word for word, the starter it was created from?
 *
 * COMPARED, not inferred. The obvious signals both say the wrong thing here:
 *
 *   · Revision count is noise. A page can reach five revisions through publishing
 *     and placement alone, and a real shop's Shipping Policy did — five revisions,
 *     acknowledged, and byte-identical to the template.
 *   · `legalDisclaimerAckAt` answers a different question. It records that somebody
 *     accepted a general "this is starter wording" disclaimer, not that they read
 *     the sentence promising orders go out in one to two working days.
 *
 * So this reads the body. No extra query — the checklist already loads these rows,
 * and it is a string compare of a document that is a few kilobytes at most.
 */
function bodyIsStillTheStarter(body: unknown, template: LegalTemplate): boolean {
  if (!template.assumes || template.assumes.length === 0) return false;
  // The WORDS, not the JSON. Postgres reorders jsonb keys on the way in, so the
  // stored document never stringifies to the same bytes as the literal it came
  // from — a comparison that looked exact would have quietly answered "edited"
  // for every page on the platform. Text is also the right question: reformatting
  // a heading has not changed what the page promises, and rewriting the return
  // window has.
  const stored = (body as { body?: unknown } | null)?.body;
  return docText(stored).join('\n') === docText(template.doc).join('\n');
}

/** Every string a document would put on the page, in order. */
function docText(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { text?: string; content?: unknown[] };
  if (typeof n.text === 'string') out.push(n.text);
  for (const child of n.content ?? []) docText(child, out);
  return out;
}

async function untouchedSinceCreationTx(tx: TxClient, entryId: string): Promise<boolean> {
  const revisions = await tx.contentRevision.findMany({
    where: { entryId },
    orderBy: { revisionNumber: 'asc' },
    select: { body: true },
    take: 2,
  });
  if (revisions.length !== 1) return false;
  const entry = await tx.contentEntry.findFirst({ where: { id: entryId }, select: { body: true } });
  return JSON.stringify(entry?.body) === JSON.stringify(revisions[0]?.body);
}

/** The pending starter update for one legal page, or null when it is already current. */
export async function legalStarterUpdateTx(
  tx: TxClient,
  entryId: string
): Promise<LegalStarterUpdate | null> {
  const entry = await tx.contentEntry.findFirst({
    where: { id: entryId, typeKey: 'page', legalKind: { not: null }, deletedAt: null },
    select: { id: true, legalKind: true, legalTemplateVersion: true },
  });
  if (!entry?.legalKind) return null;

  const template = getLegalTemplate(entry.legalKind as LegalKind);
  if (!template) return null;
  const from = entry.legalTemplateVersion ?? 0;
  if (from >= template.templateVersion) return null;

  return {
    legalKind: template.legalKind,
    title: template.title,
    fromVersion: from,
    toVersion: template.templateVersion,
    body: legalEntryBody(template),
    unedited: await untouchedSinceCreationTx(tx, entry.id),
  };
}

export function legalStarterUpdate(
  tenantId: string,
  entryId: string
): Promise<LegalStarterUpdate | null> {
  return withTenant({ tenantId }, (tx) => legalStarterUpdateTx(tx, entryId));
}

/**
 * Replace a legal page's wording with the current starter, and record that it is
 * now current.
 *
 * The old body is kept as a revision FIRST, so this is recoverable from the
 * page's own history — a replace that cannot be undone is not something to put
 * behind one button.
 *
 * The disclaimer acknowledgement is cleared on purpose. It means "a person read
 * this wording and accepted it", and after this call the wording is different;
 * carrying the old acknowledgement forward would certify text nobody has read.
 * She re-reads and re-accepts, which is the whole point of the version bump.
 */
export async function refreshLegalPageTx(
  tx: TxClient,
  ctx: CmsWriteContext,
  entryId: string
): Promise<LegalPageResult> {
  const entry = await tx.contentEntry.findFirst({
    where: { id: entryId, typeKey: 'page', legalKind: { not: null }, deletedAt: null },
  });
  if (!entry?.legalKind) throw conflict('That page is not a legal page.');

  const template = getLegalTemplate(entry.legalKind as LegalKind);
  if (!template) throw conflict(`Unknown legal template "${entry.legalKind}".`);
  if ((entry.legalTemplateVersion ?? 0) >= template.templateVersion) {
    throw conflict(`${template.title} is already on the latest starter wording.`);
  }

  // Her wording, banked before it is replaced.
  await recordRevision(tx, {
    tenantId: ctx.tenantId,
    entryId: entry.id,
    body: entry.body as Record<string, unknown>,
    seoJson: (entry.seoJson ?? {}) as Record<string, unknown>,
    status: entry.status,
    kind: 'manual',
    authorId: ctx.actorId,
    summary: 'Before taking the newer starter wording',
  });

  const next = legalEntryBody(template);
  const updated = await tx.contentEntry.update({
    where: { id: entry.id },
    data: {
      body: next as unknown as Json,
      legalTemplateVersion: template.templateVersion,
      // New words, so the old "I have read this" no longer applies.
      legalDisclaimerAckAt: null,
    },
  });

  await recordRevision(tx, {
    tenantId: ctx.tenantId,
    entryId: entry.id,
    body: next,
    seoJson: (updated.seoJson ?? {}) as Record<string, unknown>,
    status: updated.status,
    kind: 'manual',
    authorId: ctx.actorId,
    summary: `Updated to starter wording v${String(template.templateVersion)}`,
  });

  return {
    entry: updated,
    events: [
      {
        type: 'content.entry.updated',
        data: {
          entryId: updated.id,
          typeKey: updated.typeKey,
          slug: updated.slug,
          status: updated.status,
        },
      },
    ],
  };
}

export function refreshLegalPage(ctx: CmsWriteContext, entryId: string): Promise<LegalPageResult> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) => refreshLegalPageTx(tx, ctx, entryId));
}
