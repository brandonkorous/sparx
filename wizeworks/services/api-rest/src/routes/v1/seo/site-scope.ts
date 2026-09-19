// Which stored page audits belong to the site being looked at.
//
// WHY THIS EXISTS. `seo_audits` carries a `property_id` — and not one of its four
// indexes mentions it, because until now no read filtered on it. So a clothing
// maker with seven websites opened "How people find you" on her shop and read
// **51 pages checked, average 77**, when her shop has 42 and averages 76: the
// other nine were her Archive site's pages, scored against a different domain
// with different content, quietly pulling her number down (issue 391).
//
// TWO TIERS, not one, and the second is load-bearing. A `builder_page` audit
// carries the site its page belongs to. A `cms_page` / `product` / `collection`
// audit carries NULL, because those entities express their own site visibility
// through junction tables rather than a column — so NULL here means "not pinned
// by this row", and dropping those would have taken 20 of her 42 pages off the
// screen to fix a 9-page error.
//
// ── THE RESIDUAL 391 LEFT, AND WHY IT GREW ─────────────────────────────────
//
// That fix stopped there and said so: "an entity pinned to ANOTHER site still
// counts here, because its audit row does not carry the pin." By the time the
// same owner was walked again the residual was not nine pages, it was
// FORTY-SEVEN of ninety-six — because the tier it fixed (builder_page) is the
// only one of four that carries a pin, and the other three are most of a
// catalog (issue 639):
//
//     shown on her shop      96 pages · average 79 · 25 to improve
//     actually her shop's    49 pages · average 75 · 21 to improve
//
// Her Sample Sale products score 95, so the pages that are not hers made her
// shop look four points better than it is, on the one screen whose whole job is
// telling her what needs work.
//
// ── WHY THE PIN CANNOT SIMPLY BE STAMPED ───────────────────────────────────
//
// 391's own note proposed "the indexer stamps `property_id` for those three
// types". That is wrong, and it is worth writing down so nobody tries it: a
// product can be sold on SEVERAL of a business's sites, which is exactly why
// those three use junction tables instead of a column. One nullable column
// cannot hold two sites, so stamping would be right for the common case and
// silently wrong for the multi-site one — a smaller version of this same bug.
//
// The pin belongs where it already lives. The fix is on the READ side.
//
// ── WHY THIS IS SQL AND NOT A PRISMA `where` ───────────────────────────────
//
// `seo_audits.entity_id` is POLYMORPHIC: one uuid column pointing at four
// different tables, with no Prisma relation on any of them. `where` fragments
// like `contentSiteVisibilityWhere` work because `propertyLinks: { some: … }`
// compiles to an EXISTS subquery — and that is unavailable here precisely
// because there is no relation to traverse.
//
// The alternative inside Prisma is to fetch the entity ids first and pass them
// as `entityId: { in: [...] }`, which puts a list the size of a catalog into
// every request. So the predicate is one `Prisma.Sql` fragment, EXISTS per type,
// and EVERY reader takes it — the checklist query used to spell the old rule
// inline, which made it a fourth copy free to drift from the other three.

import { Prisma } from '@wizeworks/db';

// THE PRISMA `where` FORM IS GONE ON PURPOSE. It expressed the first tier only —
// the pin the audit row carries — and every one of its four callers needed both.
// Leaving it exported would leave the wrong answer sitting under the obvious
// name, which is how the checklist query came to carry its own copy of it.

/**
 * The whole rule, as one SQL predicate over an aliased `seo_audits`.
 *
 * Read it as: this row is about something this site shows. Both tiers, in order:
 *
 *   1. the audit's own pin — this site, or unpinned
 *   2. AND, for the three junction-backed types, the entity itself is either
 *      linked to no site (so every site shows it) or linked to THIS one
 *
 * An unscoped caller (`undefined`) gets `TRUE`, which means every row — the same
 * meaning the Prisma form gives an undefined property, and the case a tenant
 * with one site is in.
 *
 * `alias` is the table alias the caller used, so this can sit inside a query
 * that joins. Callers pass a LITERAL, never anything user-supplied: it is spliced
 * with `Prisma.raw`, which does not escape.
 */
export function auditsOnSiteSql(propertyId: string | undefined, alias = 'a'): Prisma.Sql {
  if (!propertyId) return Prisma.sql`TRUE`;
  const t = Prisma.raw(alias);
  return Prisma.sql`
    (${t}.property_id = ${propertyId}::uuid OR ${t}.property_id IS NULL)
    AND (
      ${t}.entity_type NOT IN ('cms_page', 'product', 'collection')
      OR (
        ${t}.entity_type = 'cms_page' AND (
          NOT EXISTS (SELECT 1 FROM content_entry_properties l WHERE l.entry_id = ${t}.entity_id)
          OR EXISTS (
            SELECT 1 FROM content_entry_properties l
            WHERE l.entry_id = ${t}.entity_id AND l.property_id = ${propertyId}::uuid
          )
        )
      )
      OR (
        ${t}.entity_type = 'product' AND (
          NOT EXISTS (SELECT 1 FROM commerce_product_properties l WHERE l.product_id = ${t}.entity_id)
          OR EXISTS (
            SELECT 1 FROM commerce_product_properties l
            WHERE l.product_id = ${t}.entity_id AND l.property_id = ${propertyId}::uuid
          )
        )
      )
      OR (
        ${t}.entity_type = 'collection' AND (
          NOT EXISTS (SELECT 1 FROM commerce_collection_properties l WHERE l.collection_id = ${t}.entity_id)
          OR EXISTS (
            SELECT 1 FROM commerce_collection_properties l
            WHERE l.collection_id = ${t}.entity_id AND l.property_id = ${propertyId}::uuid
          )
        )
      )
    )
  `;
}
