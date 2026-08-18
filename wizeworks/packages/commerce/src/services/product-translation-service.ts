// productTranslationService — per-locale copy for a product.
//
// A ProductTranslation row carries the merchant-facing strings a storefront
// swaps in when it renders in a given language: title, description, and the
// two SEO fields. The product's OWN columns stay the default locale — a
// translation never mutates them. That split is what makes fallback trivial:
// resolve the requested tag, and if there is no row for it, render the
// product as authored.
//
// Translations are a pure sub-resource of the product, which shapes three
// things:
//   * Every entry point takes a productId and 404s on a missing or
//     soft-deleted parent, so a translation can never outlive its product
//     (the FK is ON DELETE CASCADE, and a tombstoned product's copy must
//     stop resolving the moment the product does).
//   * The rows have no `deletedAt` of their own — removing a locale is a
//     HARD delete. Nothing references a translation (no cart line, no order
//     line), so there is no restrict-cascade to dodge and no reason to keep
//     a tombstone that would only collide with the (product, locale) unique
//     index the next time the merchant re-adds that language.
//   * Writes publish `product.updated`, not a topic of their own. A locale's
//     copy IS part of the product's public representation, so the search
//     projector and every other product consumer needs exactly the signal
//     they already listen for.
//
// Every state change follows the locked pattern:
//   1. Validate input via @wizeworks/commerce-schemas
//   2. Run DB work inside withTenant() (RLS context set per transaction)
//   3. Write an audit_logs row in the same transaction
//   4. Publish a Pub/Sub event AFTER commit — never inside

import {
  BulkUpsertProductTranslationsInput,
  Locale,
  UpsertProductTranslationInput,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { ProductTranslation, TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';

// ─── Public shapes ────────────────────────────────────────────────────

export interface ProductTranslationRow {
  id: string;
  productId: string;
  locale: string;
  title: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Reads ────────────────────────────────────────────────────────────

/** Every locale authored for a product, ordered by tag so the editor's list
 *  is stable across saves. Throws NOT_FOUND when the product doesn't exist or
 *  is tombstoned — an empty array must mean "no translations yet", never
 *  "no such product". */
export async function listForProduct(
  ctx: ServiceContext,
  productId: string
): Promise<ProductTranslationRow[]> {
  return withTenant(ctx, async (tx) => {
    await requireLiveProduct(tx, productId);
    const rows = await tx.productTranslation.findMany({
      where: { productId },
      orderBy: { locale: 'asc' },
    });
    return rows.map(toTranslationRow);
  });
}

/** One locale's copy. The tag is canonicalized before lookup, so `EN-us`
 *  resolves the `en-US` row rather than 404ing on casing. */
export async function get(
  ctx: ServiceContext,
  productId: string,
  rawLocale: string
): Promise<ProductTranslationRow> {
  const locale = parseLocale(rawLocale);

  const row = await withTenant(ctx, async (tx) => {
    await requireLiveProduct(tx, productId);
    return tx.productTranslation.findFirst({ where: { productId, locale } });
  });
  if (!row) throw new CommerceNotFoundError('ProductTranslation', `${productId}/${locale}`);
  return toTranslationRow(row);
}

// ─── Writes ───────────────────────────────────────────────────────────

/**
 * Create or replace one locale's copy. PUT semantics — the payload is the
 * whole row, so an omitted optional field is stored as NULL rather than
 * left at its previous value. That is what lets a merchant clear a Spanish
 * SEO description without a second verb.
 */
export async function upsert(
  ctx: ServiceContext,
  productId: string,
  rawInput: unknown
): Promise<ProductTranslationRow> {
  const input = UpsertProductTranslationInput.parse(rawInput);

  const { row, created } = await withTenant(ctx, async (tx) => {
    await requireLiveProduct(tx, productId);
    return writeTranslation(tx, ctx, productId, input);
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId, locale: row.locale, translationCreated: created },
  });

  return toTranslationRow(row);
}

/**
 * Save every locale in one round trip — the translations editor's Save
 * button. Each entry follows the same PUT semantics as `upsert`; locales
 * NOT present in the payload are left untouched (this is a multi-upsert,
 * not a replace-all, so a partial editor can't silently drop the languages
 * it wasn't showing).
 *
 * All rows land in one transaction: a payload where the 6th locale is
 * invalid must not leave the first five written.
 */
export async function bulkUpsert(
  ctx: ServiceContext,
  productId: string,
  rawInput: unknown
): Promise<ProductTranslationRow[]> {
  const input = BulkUpsertProductTranslationsInput.parse(rawInput);

  // Two entries for the same tag would have the second silently overwrite
  // the first inside the loop — the merchant's first edit vanishes with no
  // error. Reject up front. Canonicalization has already run, so `en-US`
  // and `EN-us` collide here exactly as they would in the unique index.
  const seen = new Set<string>();
  for (const entry of input.translations) {
    if (seen.has(entry.locale)) {
      throw new CommerceValidationError(`Duplicate locale "${entry.locale}"`, [
        { field: 'translations', message: `Locale "${entry.locale}" appears twice` },
      ]);
    }
    seen.add(entry.locale);
  }

  const rows = await withTenant(ctx, async (tx) => {
    await requireLiveProduct(tx, productId);
    const written: ProductTranslation[] = [];
    for (const entry of input.translations) {
      const { row } = await writeTranslation(tx, ctx, productId, entry);
      written.push(row);
    }
    return written;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId, locales: rows.map((row) => row.locale) },
  });

  return rows.map(toTranslationRow).sort((a, b) => a.locale.localeCompare(b.locale));
}

/**
 * Drop one locale entirely. Hard delete — see the header note on why these
 * rows carry no tombstone. The storefront falls straight back to the
 * product's default-locale copy on the next render.
 */
export async function remove(
  ctx: ServiceContext,
  productId: string,
  rawLocale: string
): Promise<void> {
  const locale = parseLocale(rawLocale);

  await withTenant(ctx, async (tx) => {
    await requireLiveProduct(tx, productId);

    const before = await tx.productTranslation.findFirst({ where: { productId, locale } });
    if (!before) throw new CommerceNotFoundError('ProductTranslation', `${productId}/${locale}`);

    await tx.productTranslation.delete({ where: { id: before.id } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.product_translation.deleted',
      entityType: 'ProductTranslation',
      entityId: before.id,
      diff: { before: serializeTranslation(before), after: null },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId, locale, translationDeleted: true },
  });
}

// ─── Internals ────────────────────────────────────────────────────────

/** Shared upsert body for the single + bulk paths, including the audit row.
 *  Returns `created` so the caller can report which half of the upsert ran
 *  without a second read. */
async function writeTranslation(
  tx: TxClient,
  ctx: ServiceContext,
  productId: string,
  input: UpsertProductTranslationInput
): Promise<{ row: ProductTranslation; created: boolean }> {
  const before = await tx.productTranslation.findFirst({
    where: { productId, locale: input.locale },
  });

  const fields = {
    title: input.title,
    description: input.description ?? null,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
  };

  const row = before
    ? await tx.productTranslation.update({ where: { id: before.id }, data: fields })
    : await tx.productTranslation.create({
        data: { tenantId: ctx.tenantId, productId, locale: input.locale, ...fields },
      });

  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: before
      ? 'commerce.product_translation.updated'
      : 'commerce.product_translation.created',
    entityType: 'ProductTranslation',
    entityId: row.id,
    diff: {
      before: before ? serializeTranslation(before) : null,
      after: serializeTranslation(row),
    },
  });

  return { row, created: before === null };
}

/** A translation is only meaningful under a live product — a tombstoned
 *  parent must 404 rather than accept copy nobody will ever render. */
async function requireLiveProduct(tx: TxClient, productId: string): Promise<void> {
  const product = await tx.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw new CommerceNotFoundError('Product', productId);
}

/** Validate + canonicalize a locale arriving as a path segment (where it
 *  hasn't been through a body schema). Surfaces the same VALIDATION_ERROR
 *  shape a bad body field would. */
function parseLocale(rawLocale: string): string {
  const parsed = Locale.safeParse(rawLocale);
  if (!parsed.success) {
    throw new CommerceValidationError(`Invalid locale "${rawLocale}"`, [
      {
        field: 'locale',
        message: 'Locale must be a BCP-47 language tag (e.g. en, en-US, zh-Hans)',
      },
    ]);
  }
  return parsed.data;
}

function toTranslationRow(row: ProductTranslation): ProductTranslationRow {
  return {
    id: row.id,
    productId: row.productId,
    locale: row.locale,
    title: row.title,
    description: row.description,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Audit-diff projection — the merchant-authored fields only. Ids and
 *  timestamps are already on the audit row itself. */
function serializeTranslation(row: ProductTranslation): Record<string, unknown> {
  return {
    locale: row.locale,
    title: row.title,
    description: row.description,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}
