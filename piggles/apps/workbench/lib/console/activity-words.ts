// What Piggles calls the things that happen, on What has been happening.
//
// The feed's sentences are composed by the API from `audit_logs.action`, in the
// platform's vocabulary — the same vocabulary `vocabulary.ts` renames for screen
// names, `channels.ts` renames for where a sale came from, and
// `surfaces/crm/report-field-words.ts` renames for the report builder's fields.
// The feed had none, so a shop owner's own activity list read:
//
//     Fitment product set · Configuration template created · Segment created
//     Pipeline bootstrapped · Deal stage changed · Broadcast sent
//
// Every one of those is a category name out of somebody else's trade, and every
// one of them already has a Piggles word, decided on the screen that owns it:
// What fits what, Build-your-own, Groups of customers, How things move, step,
// Email campaigns.
//
// THE RULE, the same one the other three files keep: the KEY is untouched, only
// the word changes, and an action with no entry keeps the platform's sentence.
// The platform's sentence is already correct for the great majority — "Product
// created", "Order refunded", "Booking cancelled" — and restating those here
// would be a second copy to keep in step for no gain.
//
// What is NOT here, and why: a word a shop owner already reads is left alone
// even when sparx chose it. Task, order, product, page, invoice, supplier and
// discount are all plain English. The entries below are the ones where sparx's
// word is a term of art — fitment, configurator, segment, pipeline, collection,
// variant, SKU, bill of materials, suppression, broadcast — or where this brand
// made a deliberate different choice its other screens already show.

/**
 * Audit action → the Piggles sentence.
 *
 * Keyed by the raw action rather than by the platform's sentence, so a change to
 * the platform's wording cannot silently disconnect an entry: the key is the
 * thing that happened, and that does not move.
 */
const ACTIVITY_WORDS: Readonly<Record<string, string>> = {
  // ── What fits what ────────────────────────────────────────────────────────
  //
  // "Fitment" is the industry's word for which product suits which thing. The
  // screen is called What fits what and the product panel What it fits.
  'commerce.fitment.bulk_assigned': 'What fits what set on several products',
  'commerce.fitment.category_created': 'A group added to what fits what',
  'commerce.fitment.dictionary_installed': 'A ready-made fitting list added',
  'commerce.fitment.domain_created': 'Fitting list created',
  'commerce.fitment.domain_updated': 'Fitting list updated',
  'commerce.fitment.domain_deleted': 'Fitting list deleted',
  'commerce.fitment.item_created': 'Fitting added',
  'commerce.fitment.node_created': 'Fitting option added',
  'commerce.fitment.node_updated': 'Fitting option updated',
  'commerce.fitment.node_deleted': 'Fitting option removed',
  'commerce.fitment.product_set': 'What a product fits was set',
  'commerce.fitment.row_deleted': 'A fitting removed',

  // ── Build-your-own ────────────────────────────────────────────────────────
  'commerce.configuration_template.created': 'Build-your-own set up',
  'commerce.configuration_template.updated': 'Build-your-own updated',
  'commerce.configuration_template.deleted': 'Build-your-own removed',

  // ── Groups of products, kinds of product ──────────────────────────────────
  //
  // piggles/CLAUDE.md RULE #3 names "collections" as a term nobody should be
  // made to learn.
  'commerce.collection.created': 'Group of products created',
  'commerce.collection.updated': 'Group of products updated',
  'commerce.collection.deleted': 'Group of products deleted',
  'commerce.collection.products_set': 'Products put in a group',
  'commerce.product.collections_set': 'A product put into groups',
  'commerce.product_type.created': 'Kind of product created',
  'commerce.product_type.updated': 'Kind of product updated',
  'commerce.product_type.deleted': 'Kind of product deleted',
  'commerce.product_type.forked': 'Kind of product copied',
  'commerce.product_type.schema_replaced': 'Kind of product: its fields replaced',

  // ── Versions ──────────────────────────────────────────────────────────────
  //
  // A variant is a version of a product you actually sell. The product editor's
  // own prose has said "version" since it was written; only its tab label said
  // Variants, and that was put right on 2026-09-25.
  'commerce.variant.created': 'Version created',
  'commerce.variant.updated': 'Version updated',
  'commerce.variant.archived': 'Version taken off sale',
  'commerce.variant.restored': 'Version put back on sale',
  'commerce.variant.set_default': 'Version made the one shown first',
  'commerce.variant.sku_renamed': 'Version code changed',
  'commerce.variant.options_assigned': 'Version given its choices',
  'commerce.variant.image_added': 'Picture added to a version',
  'commerce.variant.image_removed': 'Picture removed from a version',
  'commerce.variant.image_primary_set': 'Main picture set for a version',
  'commerce.variant.images_reordered': 'Version pictures reordered',
  'commerce.variant.image_bindings_set': 'Version pictures matched up',
  'commerce.variant.priced_by_rule': 'Version priced by a rule',
  'commerce.variant.pricing_detached': 'Version taken off its pricing rule',
  'commerce.product.options_replaced': 'What a product is sold by changed',

  // ── Repeat orders ─────────────────────────────────────────────────────────
  'commerce.subscription.created': 'Repeat order started',

  // ── Baskets ───────────────────────────────────────────────────────────────
  'commerce.cart.abandoned': 'A basket was left behind',
  'commerce.cart.recovered': 'A basket left behind came back',

  // ── Groups of customers ───────────────────────────────────────────────────
  'crm.segment.created': 'Group of customers created',
  'crm.segment.updated': 'Group of customers updated',
  'crm.segment.archived': 'Group of customers put away',
  'crm.segment.bootstrapped': 'Starter groups of customers set up',
  'crm.segment.members_added': 'Customers added to a group',
  'crm.segment.members_removed': 'Customers taken out of a group',

  // ── How things move: processes and steps ──────────────────────────────────
  //
  // The word this console settled on in act 281: a process is the set of steps
  // something moves through. "Board" was taken by the deals kanban.
  'crm.pipeline.created': 'Process created',
  'crm.pipeline.updated': 'Process updated',
  'crm.pipeline.archived': 'Process put away',
  'crm.pipeline.bootstrapped': 'A starter process set up',
  'crm.pipeline_stage.created': 'Step added to a process',
  'crm.pipeline_stage.updated': 'Step updated',
  'crm.pipeline_stage.deleted': 'Step removed',
  'crm.pipeline_stage.reordered': 'Steps reordered',
  'crm.deal.stage_changed': 'Deal moved to another step',
  'invoicing.stage.created': 'Step added to a workflow',
  'invoicing.stage.updated': 'Workflow step updated',
  'invoicing.stage.deleted': 'Workflow step removed',
  'invoicing.stage.reordered': 'Workflow steps reordered',
  // "Invoice or quote", not "Invoice": ONE action covers both, because
  // underneath they are one billing document, and the workflow slug that tells
  // them apart is not on the audit row. `document-words.ts` picks the right
  // single noun on a screen that has the document in its hand; a feed row does
  // not, and calling a quote an invoice is the exact mistake that file exists to
  // stop. The number beside it (Q-000017, INV-000018) says which.
  'invoicing.document.created': 'Invoice or quote created',
  'invoicing.document.updated': 'Invoice or quote updated',
  'invoicing.document.deleted': 'Invoice or quote deleted',
  'invoicing.document.created_for_order': 'Invoice or quote raised for an order',
  'invoicing.document.converted': 'Quote turned into an order',
  'invoicing.document.snapshot_frozen': 'Figures locked in',
  'invoicing.document.stage_changed': 'Invoice or quote moved to another step',
  'crm.ticket.stage_changed': 'Help request moved to another step',

  // ── Handing an order over ─────────────────────────────────────────────────
  //
  // "Fulfillment" is the one word `order-tone.ts` was written to keep off this
  // console's screens: it reads as "finished" to anybody who has not worked in
  // commerce, when it means the opposite. The order rows say On the way and
  // Ready to collect, and "handed over" is true of both.
  'crm.order.fulfillment.created': 'Order handed over',
  'crm.order.fulfillment.updated': 'Order handover updated',

  // ── Help requests ─────────────────────────────────────────────────────────
  'crm.ticket.created': 'Help request opened',
  'crm.ticket.updated': 'Help request updated',
  'crm.ticket.deleted': 'Help request deleted',
  'crm.ticket.assigned': 'Help request handed to somebody',

  // ── Things you track ──────────────────────────────────────────────────────
  'crm.object_def.created': 'Thing you track created',
  'crm.object_def.updated': 'Thing you track updated',
  'crm.object_def.archived': 'Thing you track put away',

  // ── Wholesale ─────────────────────────────────────────────────────────────
  'crm.b2b_account.created': 'Wholesale customer added',
  'crm.b2b_account.updated': 'Wholesale customer updated',
  'crm.b2b_account.deleted': 'Wholesale customer deleted',
  'crm.b2b_account_contact.created': 'Someone added at a wholesale customer',
  'crm.b2b_account_contact.updated': 'A wholesale contact updated',

  // ── Email campaigns ───────────────────────────────────────────────────────
  'email.broadcast.created': 'Email campaign created',
  'email.broadcast.sent': 'Email campaign sent',
  'email.broadcast.cancelled': 'Email campaign canceled',

  // ── Recipes ───────────────────────────────────────────────────────────────
  //
  // "Bill of materials" is what the trade calls it; the person setting one up in
  // a workshop has never used the phrase. The screen is Recipes.
  'inventory.bom.created': 'Recipe created',
  'inventory.bom.status_changed': 'Recipe status changed',

  // ── Locations, not warehouses ─────────────────────────────────────────────
  'inventory.warehouse.created': 'Location added',
  'inventory.warehouse.updated': 'Location updated',
  'inventory.warehouse.archived': 'Location put away',
  'inventory.warehouse.bootstrapped': 'Your first location set up',
  'commerce.warehouse.created': 'Location added',

  // ── Old links ─────────────────────────────────────────────────────────────
  'redirect.created': 'Old link pointed somewhere new',
  'redirect.changed': 'Old link changed',
  'redirect.deleted': 'Old link removed',
  'redirect.bulk_imported': 'Old links imported',

  // ── Kinds of content ──────────────────────────────────────────────────────
  'content_type.upserted': 'Kind of content saved',
  'content_type.deleted': 'Kind of content deleted',

  // ── What happens when, and how invoices look ──────────────────────────────
  'invoicing.template.created': 'Invoice look created',
  'invoicing.template.published': 'Invoice look published',
  'invoicing.template.set_default': 'Invoice look made the usual one',
  'invoicing.template.seeded': 'A starter invoice look set up',
};

/**
 * The Piggles sentence for an activity row, or the platform's own when this
 * brand has nothing different to say.
 *
 * `fallback` is the server-composed sentence, which is already plain English for
 * the great majority of actions — see the note at the top of this file about why
 * the absence of an entry is a statement rather than an omission.
 */
export function activityWord(action: string, fallback: string): string {
  return ACTIVITY_WORDS[action] ?? fallback;
}

/** Every action this brand renames. Exported for the guard beside it. */
export const RENAMED_ACTIONS: readonly string[] = Object.keys(ACTIVITY_WORDS);
