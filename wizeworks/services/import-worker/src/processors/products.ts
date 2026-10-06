// Products.
//
// Rebuilt from the flat one-row-one-product version, which could not represent the
// thing every commerce export actually contains: a product with variants. Shopify,
// WooCommerce, Wix, Square, BigCommerce and Adobe Commerce all spread one product
// across several rows, and the old processor turned a T-shirt with three sizes into
// three unrelated T-shirts. That is not a rough edge — it is a catalogue the tenant
// has to delete and re-enter.
//
// The shape now:
//
//   Rows are grouped by `handle`, which every vendor adapter emits. The FIRST row of
//   a group carries the product; every row carries one variant.
//
//   Option names are read from the group as a whole and their values collected in
//   first-seen order, so `Size: Small, Medium, Large` comes out in the order the
//   tenant's file had them rather than alphabetically.
//
//   Images are copied, not linked (see ./images), de-duplicated across the whole run,
//   and bound to the variant when the row named a variant-specific one.
//
// A row's result is reported against the row the tenant can see in their file, so an
// error on the fourth variant of the ninth product points at the line number they
// would find it on.
//
// Every column this file reads is a canonical field key (`ENTITY_FIELDS.products` in
// @wizeworks/migration), and `contract.test.ts` measures the two as equal. Seven of
// them used to be offered and never read: collections, quantity, needs-shipping,
// taxable, image position, published date and old URL. Taxable is off the list now,
// because a product here cannot be exempt from tax on its own (every rate without a
// product class applies to every product); the other six are saved below. A blank
// cell never clears what a product already has.

import { collectionService, productService, variantService } from '@wizeworks/commerce';
import { coreChoiceSide, isCoreOptionName } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';
import {
  toBoolean,
  toCents,
  toDecimal,
  toInteger,
  toIsoDate,
  toList,
  toSlug,
} from '@wizeworks/migration';

import { ingestImage, linkedNotice } from './images';
import { redirectOldAddress } from './redirects';
import { Resolver } from './resolve';
import { freeHandle } from './taxonomy';
import {
  type EntityProcessor,
  type ImportRow,
  type PreviewResult,
  type ProcessorContext,
  type RowResult,
} from './types';

interface Group {
  /** The product's web name here: the file's, shortened when it is too long. */
  handle: string;
  /** The file's own web name, when it had to be shortened. */
  longHandle?: string;
  head: ImportRow;
  rows: { row: ImportRow; rowIndex: number }[];
}

/** The longest web name a product can have here (`commerce_products.handle`). */
const HANDLE_MAX = 127;

/**
 * A web name that fits. Shopify allows longer ones than this platform keeps, and
 * cutting at the limit could make two different products share one name: two of
 * Gillett Diesel's FASS kits differ only by a trailing "-copy" past character 127.
 * So the cut keeps room for a short code taken from the WHOLE name, which is the
 * same on every run of the same file (sparx persona issue 054).
 */
function fitHandle(handle: string): string {
  if (handle.length <= HANDLE_MAX) return handle;
  let hash = 0;
  for (let i = 0; i < handle.length; i++) hash = (hash * 31 + handle.charCodeAt(i)) >>> 0;
  const code = hash.toString(36).padStart(7, '0').slice(-7);
  return `${handle.slice(0, HANDLE_MAX - code.length - 1).replace(/-+$/, '')}-${code}`;
}

/** Group by handle, falling back to SKU and then the title — a file with no handle
 *  column at all is still a file of products. */
function groupRows(rows: ImportRow[]): Group[] {
  const groups = new Map<string, Group>();
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const handle = toSlug(row.handle ?? '') || toSlug(row.sku ?? '') || toSlug(row.title ?? '');
    if (handle === '') continue;
    const existing = groups.get(handle);
    if (existing === undefined) {
      const fitted = fitHandle(handle);
      groups.set(handle, {
        handle: fitted,
        ...(fitted === handle ? {} : { longHandle: handle }),
        head: row,
        rows: [{ row, rowIndex }],
      });
    } else {
      existing.rows.push({ row, rowIndex });
    }
  }
  return [...groups.values()];
}

function normalizeStatus(value: string | undefined): 'draft' | 'active' | 'archived' {
  const text = (value ?? '').trim().toLowerCase();
  if (text === 'active') return 'active';
  if (text === 'archived') return 'archived';
  return 'draft';
}

function normalizeFulfillment(value: string | undefined): 'physical' | 'digital' | 'service' {
  const text = (value ?? '').trim().toLowerCase();
  if (text === 'digital') return 'digital';
  if (text === 'service') return 'service';
  return 'physical';
}

/** The heaviest thing a product here can weigh: 10 tonnes (`WeightGrams`). */
const GRAMS_MAX = 10_000_000;

/** The weight a file gives, in grams, read before it is checked. */
function rawGrams(row: ImportRow): number | undefined {
  const asGrams = toDecimal(row.weight_grams);
  if (asGrams !== undefined) return Math.round(asGrams);
  const asKg = toDecimal(row.weight_kg);
  return asKg === undefined ? undefined : Math.round(asKg * 1000);
}

/** The weight, or nothing when the file's figure cannot be a real one. */
function grams(row: ImportRow): number | undefined {
  const value = rawGrams(row);
  return value === undefined || value < 0 || value > GRAMS_MAX ? undefined : value;
}

/**
 * Why a weight was left off, or null. One impossible figure used to fail the whole
 * product: Gillett Diesel's file weighs a $480 catalytic converter at 27,265,891
 * grams, and the part never came across (sparx persona issue 054).
 */
function weightNote(row: ImportRow): string | null {
  const value = rawGrams(row);
  if (value === undefined || (value >= 0 && value <= GRAMS_MAX)) return null;
  return `The weight in your file (${(value / 1000).toLocaleString('en-US')} kg) cannot be right, so it was left off. Add the real one on the product.`;
}

/**
 * A reason a person can read. A rejected value used to reach the results screen
 * as the checker's raw JSON, field paths and regular expressions included.
 */
function describeError(error: unknown): string {
  if (error instanceof Error && 'issues' in error && Array.isArray(error.issues)) {
    const said = (error.issues as { path?: (string | number)[]; message?: string }[]).map(
      (issue) => {
        const first = issue.path?.[0];
        const field = first === undefined ? undefined : FIELD_WORDS[String(first)];
        return field ? `${field}: ${issue.message ?? 'not accepted'}` : (issue.message ?? '');
      }
    );
    const sentence = said.filter((line) => line !== '').join(' ');
    if (sentence !== '') return sentence;
  }
  return error instanceof Error ? error.message : String(error);
}

const FIELD_WORDS: Record<string, string> = {
  sku: 'SKU',
  handle: 'Web address',
  title: 'Name',
  priceCents: 'Price',
  compareAtPriceCents: 'Compare-at price',
  costCents: 'Cost',
  coreChargeCents: 'Core charge',
  weight: 'Weight',
  barcode: 'Barcode',
};

/**
 * A dimension in millimetres, or `undefined` when the file did not say.
 *
 * Returning 0 for "not given" is the obvious shortcut and it is wrong twice over:
 * commerce's schema requires every dimension to be positive, so a zero is rejected —
 * and a Shopify products export has NO dimension columns at all, which meant every
 * product in every Shopify migration failed on a validation error about a box size
 * the tenant never typed. Absent has to stay absent.
 */
function mm(cm: string | undefined, millimetres: string | undefined): number | undefined {
  const direct = toDecimal(millimetres);
  if (direct !== undefined) return Math.round(direct);
  const centimetres = toDecimal(cm);
  return centimetres === undefined ? undefined : Math.round(centimetres * 10);
}

/** The box, only if there is one. A partial set is kept — a tenant who recorded
 *  length and width and not height still knows two thirds of what fits on a shelf. */
function dimensionsOf(
  head: ImportRow
): { lengthMm?: number; widthMm?: number; heightMm?: number } | undefined {
  const lengthMm = mm(head.length_cm, head.length_mm);
  const widthMm = mm(head.width_cm, head.width_mm);
  const heightMm = mm(head.height_cm, head.height_mm);
  if (lengthMm === undefined && widthMm === undefined && heightMm === undefined) return undefined;
  return {
    ...(lengthMm === undefined ? {} : { lengthMm }),
    ...(widthMm === undefined ? {} : { widthMm }),
    ...(heightMm === undefined ? {} : { heightMm }),
  };
}

/** A SKU for a variant that arrived without one. Deterministic, so a re-run of the
 *  same file updates the same variant instead of minting a second. */
function fallbackSku(handle: string, index: number, row: ImportRow): string {
  const suffix = [row.option1_value, row.option2_value, row.option3_value]
    .filter((value) => value !== undefined && value !== '')
    .join('-');
  const base = handle
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .slice(0, 30);
  return suffix === ''
    ? `${base}-${index + 1}`
    : `${base}-${suffix.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`.slice(0, 100);
}

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/** The variant's option values as a SKU tail: `Defer Core Charge` → `DEFER-CORE-CHARGE`. */
function optionTail(row: ImportRow): string {
  return [row.option1_value, row.option2_value, row.option3_value]
    .filter(present)
    .join('-')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface PlannedSku {
  sku: string;
  note?: string;
  /** The same item listed a second time (same SKU, same price, same choices or
   *  none): brought in once, and this row is skipped with a note. */
  duplicateOf?: number;
}

/**
 * The SKU every row is saved under, decided for the whole file before anything is
 * written, keyed by row index.
 *
 * A SKU names one item here (unique per business). The old platform may not insist:
 * Gillett Diesel's Shopify file gave both choices of 94 products one SKU ("Accept Core
 * Charge" and "Defer Core Charge" were both `0986435621`), and two different products
 * the SKU `-`. Matched by SKU, the second row overwrote the first one's price, or turned
 * one product into an update of another. So the first row keeps the SKU, a repeat gets
 * the SKU plus its option values (or a number), and a note says so. The plan depends on
 * the file alone, so a re-run of the same file lands on the same items.
 *
 * A "SKU" with no letter or digit in it (`-`, `--`) is a placeholder, not a SKU, and is
 * treated as missing.
 */
function planSkus(groups: Group[]): Map<number, PlannedSku> {
  const plan = new Map<number, PlannedSku>();
  const used = new Set<string>();
  for (const group of groups) {
    // Within one product, the first row to use each SKU: what it chose and cost.
    const firstBySku = new Map<string, { rowIndex: number; tail: string; price: string }>();
    for (const { row, rowIndex } of group.rows) {
      const given = (row.sku ?? '').trim();
      const tail = optionTail(row);
      const price = (row.price ?? '').trim();
      const first = given === '' ? undefined : firstBySku.get(given.toLowerCase());
      // The same item listed twice: an old export's second row, or a copy with no
      // choice beside one that has it. Brought in once; a rename would invent a
      // second product the shop never sold (Gillett Diesel's file has ten).
      if (first?.price === price && (first.tail === tail || tail === '' || first.tail === '')) {
        plan.set(rowIndex, {
          sku: given,
          duplicateOf: first.rowIndex,
          note: `An earlier row lists the same item (SKU “${given}”, same price), so it was brought in once.`,
        });
        continue;
      }
      if (given !== '' && !first) firstBySku.set(given.toLowerCase(), { rowIndex, tail, price });
    }
    group.rows.forEach(({ row, rowIndex }, index) => {
      if (plan.get(rowIndex)?.duplicateOf !== undefined) return;
      const given = (row.sku ?? '').trim();
      const real = /[A-Za-z0-9]/.test(given);
      const wanted = real ? given : fallbackSku(group.handle, index, row);
      let sku = wanted;
      let note: string | undefined;
      if (used.has(sku.toLowerCase())) {
        const tail = optionTail(row);
        let attempt = tail === '' ? 2 : 1;
        do {
          const suffix =
            tail === '' ? String(attempt) : attempt === 1 ? tail : `${tail}-${String(attempt)}`;
          sku = `${wanted.slice(0, 99 - suffix.length)}-${suffix}`;
          attempt += 1;
        } while (used.has(sku.toLowerCase()));
        note = `Your file gives the SKU “${wanted}” to more than one item. A SKU names one item here, so this one is saved as “${sku}”.`;
      } else if (given !== '' && !real) {
        note = `“${given}” is not a SKU, so this item is saved as “${sku}”.`;
      }
      used.add(sku.toLowerCase());
      plan.set(rowIndex, note === undefined ? { sku } : { sku, note });
    });
  }
  return plan;
}

/** A barcode the variant can hold: 8 to 14 digits (UPC, EAN, GTIN). Anything else
 *  would fail the whole variant, so it is left off with a note instead. */
function barcodeOf(value: string | undefined): { barcode?: string; note?: string } {
  if (!present(value)) return {};
  const text = value.trim();
  return /^\d{8,14}$/.test(text)
    ? { barcode: text }
    : {
        note: `“${text}” is not a barcode that can be stored here (8 to 14 digits), so it was left off.`,
      };
}

/**
 * The product's gallery, in order.
 *
 * Vendor adapters gather it onto the first row as `images`. A file mapped by hand
 * usually carries one `image_url` per row instead, with `image_position` saying
 * where it goes, which is how most platforms export a gallery; those are collected
 * from every row of the product and put in position order, a row without a
 * position keeping its place in the file after the numbered ones.
 */
function galleryOf(group: Group): { url: string; alt?: string }[] {
  const headAlt = present(group.head.image_alt) ? group.head.image_alt.trim() : undefined;
  const listed = toList(group.head.images);
  if (listed.length > 0) {
    return listed.map((url) => ({ url, ...(headAlt === undefined ? {} : { alt: headAlt }) }));
  }

  const placed: { url: string; alt?: string; position: number; order: number }[] = [];
  group.rows.forEach(({ row }, order) => {
    const urls = toList(row.image_url);
    if (urls.length === 0) return;
    const position = toInteger(row.image_position);
    const alt = present(row.image_alt) ? row.image_alt.trim() : headAlt;
    for (const url of urls) {
      placed.push({
        url,
        ...(alt === undefined ? {} : { alt }),
        position: position ?? Number.POSITIVE_INFINITY,
        order,
      });
    }
  });
  placed.sort((a, b) => a.position - b.position || a.order - b.order);

  const seen = new Set<string>();
  const gallery: { url: string; alt?: string }[] = [];
  for (const image of placed) {
    if (seen.has(image.url)) continue;
    seen.add(image.url);
    gallery.push({ url: image.url, ...(image.alt === undefined ? {} : { alt: image.alt }) });
  }
  return gallery;
}

/**
 * The manual collections a product's `collections` cell names, created where missing.
 *
 * Matched by name or handle, case-insensitively, so a file listing `Summer Sale` finds
 * the collection whose handle is `summer-sale`. A collection that does not exist yet is
 * created, like a location a stock file names: the collections file in the same move
 * lands after products and fills in its description and image. A collection that picks
 * its products by a rule cannot have one added by hand, so it is reported instead.
 */
class CollectionLinker {
  private readonly byName = new Map<string, { id: string } | { rule: string }>();

  constructor(private readonly ctx: ProcessorContext) {}

  async resolve(names: string[]): Promise<{ ids: string[]; notes: string[] }> {
    const ids: string[] = [];
    const created: string[] = [];
    const ruled: string[] = [];
    for (const name of names) {
      const key = name.trim().toLowerCase();
      if (key === '') continue;
      let found = this.byName.get(key);
      if (found === undefined) {
        const existing = await withTenant(this.ctx, (tx) =>
          tx.productCollection.findFirst({
            where: {
              tenantId: this.ctx.tenantId,
              deletedAt: null,
              OR: [
                { name: { equals: name.trim(), mode: 'insensitive' } },
                { handle: toSlug(name) },
              ],
            },
            select: { id: true, type: true, name: true },
          })
        );
        if (existing === null) {
          const made = await collectionService.create(this.ctx, {
            name: name.trim().slice(0, 127),
            handle: await freeHandle(this.ctx, 'collection', name),
            type: 'manual',
          });
          found = { id: made.id };
          created.push(name.trim());
        } else {
          found = existing.type === 'manual' ? { id: existing.id } : { rule: existing.name };
        }
        this.byName.set(key, found);
      }
      if ('id' in found) {
        if (!ids.includes(found.id)) ids.push(found.id);
      } else {
        ruled.push(found.rule);
      }
    }

    const notes: string[] = [];
    if (created.length > 0) {
      notes.push(
        `Created the collection${created.length === 1 ? '' : 's'} ${created.map((n) => `“${n}”`).join(', ')}.`
      );
    }
    if (ruled.length > 0) {
      notes.push(
        `${ruled.map((n) => `“${n}”`).join(', ')} ${ruled.length === 1 ? 'picks its' : 'pick their'} products by a rule, so this product was not added by hand.`
      );
    }
    return { ids, notes };
  }
}

/** One placement of a picture on a product: the version it belongs to (or none). */
function imageKey(variantId: string | null, mediaAssetId: string): string {
  return `${variantId ?? '-'}:${mediaAssetId}`;
}

/** The placements a product already has, as `imageKey`s. */
async function attachedImages(ctx: ProcessorContext, productId: string): Promise<Set<string>> {
  const images = await withTenant(ctx, (tx) =>
    tx.variantImage.findMany({
      where: { productId },
      select: { variantId: true, mediaAssetId: true },
    })
  );
  return new Set(images.map((image) => imageKey(image.variantId, image.mediaAssetId)));
}

/** The collections a product is already in by hand, so an import adds to them rather
 *  than replacing them. */
async function manualCollectionsOf(ctx: ProcessorContext, productId: string): Promise<string[]> {
  const links = await withTenant(ctx, (tx) =>
    tx.collectionProduct.findMany({
      where: { productId, addedBy: 'manual' },
      select: { collectionId: true },
      orderBy: { position: 'asc' },
    })
  );
  return links.map((link) => link.collectionId);
}

/**
 * The quantity on a product row, counted at the main location.
 *
 * Only for an item with no stock recorded anywhere yet. A product file is the old
 * platform's total, not a count per shelf: applied to an item that already has
 * stock here it would overwrite a real count with an old one. And not at all when
 * the same move carries a stock levels file, which counts each location properly;
 * applying both would put the same stock on the shelf twice.
 */
async function applyQuantity(
  ctx: ProcessorContext,
  resolver: Resolver,
  variantId: string,
  quantity: number,
  vendor: string | undefined
): Promise<string | null> {
  const counted = await withTenant(ctx, (tx) =>
    tx.inventoryLevel.findFirst({ where: { variantId }, select: { variantId: true } })
  );
  if (counted !== null) {
    return 'Stock was already recorded for this item, so the file’s quantity was left alone.';
  }
  const warehouse = await resolver.warehouseByName('');
  await inventoryService.updateLevelCount(ctx, variantId, {
    warehouseId: warehouse.id,
    onHand: Math.max(quantity, 0),
    reason: 'recount',
    note:
      vendor === undefined
        ? 'Imported with the product'
        : `Imported with the product from ${vendor}`,
    idempotencyKey: `import:${ctx.tenantId}:${variantId}:${warehouse.id}:${quantity}`,
  });
  return warehouse.created ? 'Created the location “Main” for its stock.' : null;
}

/** Option names and their values, in the order the file presented them. */
function optionsOf(group: Group): { name: string; values: string[] }[] {
  const options: { name: string; values: string[] }[] = [];
  for (let axis = 1; axis <= 3; axis++) {
    const name = (group.head[`option${axis}_name`] ?? '').trim();
    if (name === '') continue;
    const values: string[] = [];
    for (const { row } of group.rows) {
      const value = (row[`option${axis}_value`] ?? '').trim();
      if (value !== '' && !values.includes(value)) values.push(value);
    }
    if (values.length > 0) options.push({ name, values });
  }
  return options;
}

/**
 * A core charge the old store sold as a CHOICE (sparx persona issue 057): one
 * option about the core whose two values are a "ship now" side and an "old part
 * first" side ("Accept Core Charge (+$150)" / "Defer Core Charge"). It comes across
 * as it was, and the owner is told where to turn it into a real deposit.
 */
function fileCoreChoice(declared: { name: string; values: string[] }[]): string | null {
  const core = declared.filter((option) => isCoreOptionName(option.name));
  if (core.length !== 1 || core[0]!.values.length !== 2) return null;
  const sides = core[0]!.values.map(coreChoiceSide);
  return sides.includes('deposit') && sides.includes('first') ? core[0]!.name : null;
}

const CORE_CHOICE_NOTE =
  'Its core charge is set up as a choice, the way your old store did it. Turn it into a real core deposit on the “Core charges set up as choices” screen.';

const CONVERTED_NOTE =
  'Its core charge is a real deposit here now, so the old store’s core choice and its prices in this file were left as they are. Its other details were brought in.';

/**
 * Whether this product's core choice was already turned into a deposit here: it
 * has no core option left and a version carries a deposit. Bringing the same file
 * in again must not undo that. Its "ship now" price would go back on top of the
 * deposit and charge the core twice, and the retired side's code would be made
 * again beside the one that stayed.
 */
async function coreChoiceConverted(ctx: ProcessorContext, productId: string): Promise<boolean> {
  return withTenant(ctx, async (tx) => {
    const [options, deposit] = await Promise.all([
      tx.productOption.findMany({ where: { productId }, select: { name: true } }),
      tx.productVariant.findFirst({
        where: { productId, deletedAt: null, coreChargeCents: { not: null } },
        select: { id: true },
      }),
    ]);
    return deposit !== null && !options.some((option) => isCoreOptionName(option.name));
  });
}

export const productsProcessor: EntityProcessor = {
  entity: 'products',
  module: 'commerce',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);
    const collections = new CollectionLinker(ctx);
    const groups = groupRows(rows);
    const skus = planSkus(groups);
    const results: RowResult[] = [];

    const claimed = new Set(groups.flatMap((group) => group.rows.map((entry) => entry.rowIndex)));
    for (let index = 0; index < rows.length; index++) {
      if (!claimed.has(index)) {
        results.push({
          rowIndex: index,
          status: 'error',
          errorMsg: 'This row has no product name, SKU or handle, so there is nothing to create.',
        });
      }
    }

    for (const group of groups) {
      const { head, handle } = group;
      const notes: string[] = [];
      if (group.longHandle !== undefined) {
        notes.push(
          `Its web address was too long to keep, so it is now /products/${handle}. The old one sends people here.`
        );
      }
      const headWeight = weightNote(head);
      if (headWeight !== null) notes.push(headWeight);

      try {
        const title = (head.title ?? '').trim();
        if (title === '') {
          for (const { rowIndex } of group.rows) {
            results.push({
              rowIndex,
              status: 'error',
              naturalKey: handle,
              errorMsg: 'This product has no title.',
            });
          }
          continue;
        }

        // Match an existing product by handle first, then by any SKU in the group —
        // a tenant who renamed a product on the old platform still has the same SKUs.
        let productId: string | null = null;
        const byHandle = await withTenant(ctx, (tx) =>
          tx.product.findFirst({
            where: { tenantId: ctx.tenantId, handle, deletedAt: null },
            select: { id: true },
          })
        );
        productId = byHandle?.id ?? null;
        if (productId === null) {
          for (const { rowIndex } of group.rows) {
            const sku = skus.get(rowIndex)?.sku ?? '';
            if (sku === '') continue;
            const variant = await resolver.variantBySku(sku);
            if (variant !== null) {
              productId = variant.productId;
              break;
            }
          }
        }

        if (productId !== null && !options.upsert) {
          for (const { rowIndex } of group.rows) {
            results.push({ rowIndex, status: 'skipped', naturalKey: handle });
          }
          continue;
        }

        const categoryId =
          head.category === undefined ? null : await resolver.categoryByName(head.category);

        // Collections the file names, ADDED to the ones the product is already in by
        // hand. The service replaces the whole set, so the existing links are read
        // first; a product is never taken out of a collection because a file did not
        // mention it.
        const collectionNames = toList(head.collections);
        const linked =
          collectionNames.length === 0 ? null : await collections.resolve(collectionNames);
        if (linked !== null) notes.push(...linked.notes);

        const requiresShipping = toBoolean(head.requires_shipping);
        const tags = toList(head.tags)
          .slice(0, 50)
          .map((tag) => tag.slice(0, 63));

        const productInput = {
          title: title.slice(0, 255),
          handle,
          ...(head.description !== undefined && head.description !== ''
            ? { description: head.description.slice(0, 50_000) }
            : {}),
          // Status, tags and fulfillment used to be written from a blank cell too, so
          // re-importing a file with no status column put every live product back to
          // draft and wiped its tags. Only a cell with a value changes them now.
          ...(present(head.status) || productId === null
            ? { status: normalizeStatus(head.status) }
            : {}),
          ...(head.vendor !== undefined && head.vendor !== ''
            ? { vendor: head.vendor.slice(0, 127) }
            : {}),
          ...(head.product_type !== undefined && head.product_type !== ''
            ? { productType: head.product_type.slice(0, 127) }
            : {}),
          ...(tags.length > 0 ? { tags } : {}),
          ...(present(head.fulfillment_type) || productId === null
            ? { fulfillmentType: normalizeFulfillment(head.fulfillment_type) }
            : {}),
          ...(requiresShipping === undefined ? {} : { requiresShipping }),
          ...(grams(head) !== undefined ? { weight: grams(head) } : {}),
          ...(dimensionsOf(head) === undefined ? {} : { dimensions: dimensionsOf(head) }),
          ...(head.seo_title !== undefined && head.seo_title !== ''
            ? { seoTitle: head.seo_title.slice(0, 255) }
            : {}),
          ...(head.seo_description !== undefined && head.seo_description !== ''
            ? { seoDescription: head.seo_description.slice(0, 512) }
            : {}),
          ...(categoryId === null ? {} : { categoryIds: [categoryId] }),
          ...(ctx.propertyId == null ? {} : { propertyIds: [ctx.propertyId] }),
        };

        const isNew = productId === null;
        if (productId === null) {
          const created = await productService.create(ctx, {
            ...productInput,
            ...(linked === null ? {} : { collectionIds: linked.ids }),
            options: [],
            variants: [],
          });
          productId = created.id;
        } else {
          const collectionIds =
            linked === null
              ? undefined
              : [...new Set([...(await manualCollectionsOf(ctx, productId)), ...linked.ids])];
          await productService.update(ctx, productId, {
            ...productInput,
            ...(collectionIds === undefined ? {} : { collectionIds }),
          });
        }

        // The date it first went on sale, for a product that is on sale. The service
        // stamps "now" when a product goes live, which on migration day would make the
        // whole catalogue brand new and reorder every "newest first" list; the file's
        // date is the true one. Written directly because no service input carries it.
        const publishedAt = toIsoDate(head.published_at);
        if (publishedAt !== undefined && normalizeStatus(head.status) === 'active') {
          const id = productId;
          await withTenant(ctx, (tx) =>
            tx.product.update({ where: { id }, data: { publishedAt: new Date(publishedAt) } })
          );
        }

        // Its old address, redirected to the new one so links to it keep working.
        const redirectNote = await redirectOldAddress(
          ctx,
          options,
          head.source_url,
          `/products/${handle}`
        );
        if (redirectNote !== null) notes.push(redirectNote);

        // ── Options ────────────────────────────────────────────────────────────
        // Set from the whole group at once. `setOptions` replaces the set, which is
        // right for an import: the file is the statement of what the options are.
        // Except a core choice already turned into a deposit here (issue 057): the
        // file cannot say what it became, so its choice and prices are left alone.
        const declared = optionsOf(group);
        const coreChoice = fileCoreChoice(declared);
        const converted =
          coreChoice !== null && !isNew && (await coreChoiceConverted(ctx, productId));
        if (coreChoice !== null && !converted) notes.push(CORE_CHOICE_NOTE);
        const valueIdByOption = new Map<string, Map<string, string>>();
        if (declared.length > 0 && !converted) {
          const saved = await variantService.setOptions(ctx, productId, {
            options: declared.map((option, position) => ({
              name: option.name.slice(0, 63),
              position,
              values: option.values.slice(0, 250).map((value, valuePosition) => ({
                value: value.slice(0, 127),
                position: valuePosition,
              })),
            })),
          });
          for (const option of saved) {
            const byValue = new Map<string, string>();
            for (const value of option.values) byValue.set(value.value.toLowerCase(), value.id);
            valueIdByOption.set(option.name.toLowerCase(), byValue);
          }
        }

        // ── Images ─────────────────────────────────────────────────────────────
        // The pictures a product already has, so a second run of the same file
        // does not hang each one again. It did: re-importing Gillett Diesel's file
        // gave all 643 products every picture twice (sparx persona issue 055).
        // Keyed by picture AND version, since a version's own picture is a
        // different placement of what may be the same file.
        //
        // Every picture is brought in FIRST and what the product holds is read
        // after: bringing one in can swap an earlier run's link for the real copy
        // on this very product, and reading before that would hang the copy twice.
        const assetByUrl = new Map<string, string>();
        const brought: { image: { url: string; alt?: string }; assetId: string }[] = [];
        let linkedNoted = false;
        for (const image of galleryOf(group).slice(0, 30)) {
          const ingested = await ingestImage(ctx, image.url, {
            ...(image.alt === undefined ? {} : { alt: image.alt }),
          });
          assetByUrl.set(image.url, ingested.assetId);
          brought.push({ image, assetId: ingested.assetId });
          if (!ingested.copied && ingested.reason !== undefined && !linkedNoted) {
            notes.push(linkedNotice(ingested.reason));
            linkedNoted = true;
          }
        }
        const attached = isNew ? new Set<string>() : await attachedImages(ctx, productId);
        let position = attached.size;
        for (const { image, assetId } of brought) {
          const ingested = { assetId };
          if (attached.has(imageKey(null, ingested.assetId))) continue;
          attached.add(imageKey(null, ingested.assetId));
          await variantService.addImage(ctx, {
            productId,
            mediaAssetId: ingested.assetId,
            position,
            ...(image.alt === undefined ? {} : { alt: image.alt }),
          });
          position += 1;
        }

        if (converted) {
          group.rows.forEach(({ rowIndex }, index) => {
            results.push({
              rowIndex,
              status: 'skipped',
              naturalKey: skus.get(rowIndex)?.sku ?? handle,
              errorMsg: index === 0 ? [CONVERTED_NOTE, ...notes].join(' ') : CONVERTED_NOTE,
            });
          });
          continue;
        }

        // ── Variants ───────────────────────────────────────────────────────────
        for (let index = 0; index < group.rows.length; index++) {
          const { row, rowIndex } = group.rows[index]!;
          try {
            const planned = skus.get(rowIndex);
            if (planned?.duplicateOf !== undefined) {
              results.push({
                rowIndex,
                status: 'skipped',
                naturalKey: planned.sku,
                ...(planned.note === undefined ? {} : { errorMsg: planned.note }),
              });
              continue;
            }
            const sku = planned?.sku ?? fallbackSku(handle, index, row);
            const existingVariant = await resolver.variantBySku(sku);

            const optionValueIds: string[] = [];
            for (let axis = 1; axis <= 3; axis++) {
              const name = (head[`option${axis}_name`] ?? '').trim().toLowerCase();
              const value = (row[`option${axis}_value`] ?? '').trim().toLowerCase();
              if (name === '' || value === '') continue;
              const id = valueIdByOption.get(name)?.get(value);
              if (id !== undefined) optionValueIds.push(id);
            }

            const rowNotes = index === 0 ? [...notes] : [];
            // A later version's own impossible weight; the first row's is above.
            const rowWeight = index === 0 ? null : weightNote(row);
            if (rowWeight !== null) rowNotes.push(rowWeight);
            if (planned?.note !== undefined) rowNotes.push(planned.note);
            const priceCents = toCents(row.price);
            const { barcode, note: barcodeNote } = barcodeOf(row.barcode);
            if (barcodeNote !== undefined) rowNotes.push(barcodeNote);
            const variantShipping = toBoolean(row.requires_shipping) ?? requiresShipping;
            const variantInput = {
              ...(priceCents !== undefined ? { priceCents } : {}),
              ...(toCents(row.compare_at_price) !== undefined
                ? { compareAtPriceCents: toCents(row.compare_at_price) }
                : {}),
              ...(toCents(row.cost_per_item) !== undefined
                ? { costCents: toCents(row.cost_per_item) }
                : {}),
              // A refundable core deposit on a rebuilt part (sparx issue 051). A
              // zero is "none", which the variant stores as no deposit at all.
              ...(toCents(row.core_charge) !== undefined
                ? {
                    coreChargeCents:
                      (toCents(row.core_charge) ?? 0) > 0 ? toCents(row.core_charge) : null,
                  }
                : {}),
              ...(barcode === undefined ? {} : { barcode }),
              ...(grams(row) !== undefined ? { weight: grams(row) } : {}),
            };
            const quantity =
              options.stockLevelsInRun === true ? undefined : toInteger(row.quantity);

            if (existingVariant !== null && existingVariant.productId === productId) {
              await variantService.update(ctx, existingVariant.id, {
                ...variantInput,
                ...(variantShipping === undefined ? {} : { requiresShipping: variantShipping }),
              });
              if (optionValueIds.length > 0) {
                await variantService.assignOptionValues(ctx, {
                  variantId: existingVariant.id,
                  optionValueIds,
                });
              }
              if (quantity !== undefined) {
                const stockNote = await applyQuantity(
                  ctx,
                  resolver,
                  existingVariant.id,
                  quantity,
                  options.vendor
                );
                if (stockNote !== null) rowNotes.push(stockNote);
              }
              results.push({
                rowIndex,
                status: 'updated',
                naturalKey: sku,
                ...(rowNotes.length > 0 ? { errorMsg: rowNotes.join(' ') } : {}),
              });
              continue;
            }

            const created = await variantService.create(ctx, productId, {
              sku,
              priceCents: priceCents ?? 0,
              ...variantInput,
              isDefault: index === 0,
              // `deny` stops the storefront selling past zero; an export that tracks
              // nothing gets `continue`, which is what the old platform was doing.
              inventoryPolicy:
                (row.track_inventory ?? '').toLowerCase() === 'false' ? 'continue' : 'deny',
              requiresShipping:
                variantShipping ?? normalizeFulfillment(head.fulfillment_type) === 'physical',
              currency:
                row.currency !== undefined && /^[A-Za-z]{3}$/.test(row.currency)
                  ? row.currency.toUpperCase()
                  : 'USD',
              optionValueIds,
            });
            resolver.rememberVariant(sku, { id: created.id, productId });

            if (quantity !== undefined) {
              const stockNote = await applyQuantity(
                ctx,
                resolver,
                created.id,
                quantity,
                options.vendor
              );
              if (stockNote !== null) rowNotes.push(stockNote);
            }

            // A variant-specific photo, bound so the storefront swaps it on selection.
            const variantImage = (row.variant_image_url ?? '').trim();
            if (variantImage !== '') {
              const assetId =
                assetByUrl.get(variantImage) ?? (await ingestImage(ctx, variantImage)).assetId;
              await variantService.addImage(ctx, {
                productId,
                variantId: created.id,
                mediaAssetId: assetId,
                position: position + index,
                ...(optionValueIds.length > 0 ? { optionValueIds } : {}),
              });
            }

            results.push({
              rowIndex,
              status: isNew ? 'imported' : 'updated',
              naturalKey: sku,
              ...(rowNotes.length > 0 ? { errorMsg: rowNotes.join(' ') } : {}),
            });
          } catch (error) {
            const message = describeError(error);
            logger.warn({ err: error, handle, rowIndex }, 'variant row failed');
            results.push({ rowIndex, status: 'error', naturalKey: handle, errorMsg: message });
          }
        }
      } catch (error) {
        const message = describeError(error);
        logger.warn({ err: error, handle }, 'product group failed');
        for (const { rowIndex } of group.rows) {
          results.push({ rowIndex, status: 'error', naturalKey: handle, errorMsg: message });
        }
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },

  async preview(ctx, rows, logger) {
    const resolver = new Resolver(ctx);
    const groups = groupRows(rows);
    const skus = planSkus(groups);
    const results: PreviewResult[] = [];

    const claimed = new Set(groups.flatMap((group) => group.rows.map((entry) => entry.rowIndex)));
    for (let index = 0; index < rows.length; index++) {
      if (!claimed.has(index)) {
        results.push({
          rowIndex: index,
          action: 'error',
          errorMsg: 'Nothing identifies this row.',
        });
      }
    }

    for (const group of groups) {
      let exists = false;
      // The practice run says what the real one will about a core choice too.
      const coreChoice = fileCoreChoice(optionsOf(group));
      let converted = false;
      try {
        const byHandle = await withTenant(ctx, (tx) =>
          tx.product.findFirst({
            where: { tenantId: ctx.tenantId, handle: group.handle, deletedAt: null },
            select: { id: true },
          })
        );
        exists = byHandle !== null;
        if (byHandle !== null && coreChoice !== null) {
          converted = await coreChoiceConverted(ctx, byHandle.id);
        }
      } catch (error) {
        logger.warn({ err: error }, 'product preview failed');
      }

      if (converted) {
        for (const { rowIndex } of group.rows) {
          results.push({
            rowIndex,
            action: 'skip',
            naturalKey: skus.get(rowIndex)?.sku ?? group.handle,
            errorMsg: CONVERTED_NOTE,
          });
        }
        continue;
      }

      for (const [position, { row, rowIndex }] of group.rows.entries()) {
        const planned = skus.get(rowIndex);
        const sku = planned?.sku ?? '';
        const variant = sku === '' ? null : await resolver.variantBySku(sku);
        const untitled = (row.title ?? '').trim() === '';
        if (planned?.duplicateOf !== undefined) {
          results.push({
            rowIndex,
            action: 'skip',
            naturalKey: planned.sku,
            ...(planned.note === undefined ? {} : { errorMsg: planned.note }),
          });
          continue;
        }
        results.push({
          rowIndex,
          action: untitled ? 'error' : variant !== null || exists ? 'update' : 'create',
          naturalKey: sku === '' ? group.handle : sku,
          // The practice run says what the real one will: a SKU the file gives
          // twice is saved under a new one, and the owner hears it BEFORE pressing
          // the real button, not after (sparx persona issue 049).
          ...(untitled
            ? { errorMsg: 'No title.' }
            : previewNote(
                planned?.note,
                position === 0 && coreChoice !== null ? CORE_CHOICE_NOTE : undefined
              )),
        });
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },
};

/** One or two sentences for a practice-run row, or nothing. */
function previewNote(...parts: (string | undefined)[]): { errorMsg?: string } {
  const said = parts.filter((part): part is string => part !== undefined);
  return said.length === 0 ? {} : { errorMsg: said.join(' ') };
}

export const productInternals = {
  fileCoreChoice,
  groupRows,
  optionsOf,
  fallbackSku,
  normalizeStatus,
  grams,
  galleryOf,
  barcodeOf,
};
