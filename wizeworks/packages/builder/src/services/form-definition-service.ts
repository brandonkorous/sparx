// Publish-time form extraction (docs/115).
//
// SECURITY BOUNDARY. A ContactForm node authors its recipient addresses into the
// DRAFT tree (dashboard-only). At publish those addresses must NOT reach the
// client-delivered published tree — the storefront serves it to every visitor, so
// an email in a node's props is harvestable spam bait. This runs inside
// pageService.publish (and layoutService.publish), AFTER expandTreeForPublish and
// BEFORE the tree is stored: it materializes each form's recipients into a
// server-only FormDefinition row keyed by (property, stable node id), and STRIPS
// the secret props from the tree that gets published.
//
// It returns the tree to STORE. When a page carries no form, the input tree is
// returned untouched (no clone). When it does, we clone first — expandTreeForPublish
// returns the SAME draft object when there are no custom components (its early
// return), so mutating in place would corrupt the in-memory draft.

import {
  collectNodesByType,
  formRoutingConfig,
  readContactFormConfig,
  readSilicaFormConfig,
  CONTACT_FORM_TYPE,
  CONTACT_FORM_SECRET_PROPS,
  type BuilderNode,
  type SilicaFormConfig,
} from '@wizeworks/builder-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, TxClient } from '@wizeworks/db';

import type { PropertyContext } from '../errors';

/** Extract recipients → FormDefinition and strip them from the tree. Returns the
 *  sanitized tree to publish (the same object when there is nothing to strip). */
export async function syncFormDefinitions(
  tx: TxClient,
  ctx: PropertyContext,
  pageSlug: string | null,
  tree: BuilderNode
): Promise<BuilderNode> {
  if (collectNodesByType(tree, CONTACT_FORM_TYPE).length === 0) return tree;

  // Clone before mutating — the input may alias the in-memory draft tree.
  const sanitized = structuredClone(tree);
  for (const node of collectNodesByType(sanitized, CONTACT_FORM_TYPE)) {
    const cfg = readContactFormConfig(node.props);
    // The non-sensitive routing toggles ride into `config` so the automation worker
    // can route the submission (notify / autoresponder / CRM) without the published
    // tree; the sensitive recipient addresses stay in their own column.
    const config = formRoutingConfig(cfg) as unknown as Prisma.InputJsonValue;
    await tx.formDefinition.upsert({
      where: { propertyId_formNodeId: { propertyId: ctx.propertyId, formNodeId: node.id } },
      create: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        formNodeId: node.id,
        pageSlug,
        recipients: cfg.recipients,
        config,
      },
      update: { pageSlug, recipients: cfg.recipients, config },
    });
    for (const secret of CONTACT_FORM_SECRET_PROPS) {
      delete node.props[secret];
    }
  }
  // Orphan FormDefinition rows (a form later deleted) are harmless: the submit
  // endpoint only reads a def a LIVE form node references, and node ids are never
  // reused. A periodic prune can reclaim them later.
  return sanitized;
}

// ── Silica forms: the row IS the config (docs/115 on silica) ─────────────────
//
// No publish-time extraction here, because there is nothing to extract. A silica
// form's tree carries only the form; its routing lives ONLY in this row, written
// directly by the author from the builder's form-settings panel. That removes the
// whole class of bug the strip above exists to prevent — a recipient address cannot
// leak into a published tree it was never in.

export interface SilicaFormDefinition {
  formNodeId: string;
  /** The page the author configured this form on — for the inbox, not for auth. */
  pageSlug: string | null;
  recipients: string[];
  config: SilicaFormConfig;
}

/** This form's saved settings, or the defaults when the author has never opened the
 *  panel. Never null: an unconfigured form is a working form (notify the account
 *  email), so the panel and the submit path agree on what "not set up yet" means. */
export async function getSilicaForm(
  ctx: PropertyContext,
  formNodeId: string
): Promise<SilicaFormDefinition> {
  const row = await withTenant(ctx, (tx) =>
    tx.formDefinition.findUnique({
      where: { propertyId_formNodeId: { propertyId: ctx.propertyId, formNodeId } },
      select: { pageSlug: true, recipients: true, config: true },
    })
  );
  return {
    formNodeId,
    pageSlug: row?.pageSlug ?? null,
    recipients: row?.recipients ?? [],
    config: readSilicaFormConfig(row?.config),
  };
}

/** One form a campaign can be pointed at. */
export interface FormChoice {
  formNodeId: string;
  /** The author's own name for it, when they have given one. */
  name: string | null;
  /** Null means the site's home page — the same convention the submit route uses. */
  pageSlug: string | null;
}

/**
 * Every form on this site, for a picker.
 *
 * Distinct from `submissionForms`, which derives its list from SUBMISSIONS and
 * therefore only knows a form once somebody has filled it in. That is exactly
 * backwards for choosing what a campaign counts: the moment you want to point a
 * campaign at a form is before anyone has used it.
 *
 * Ordered by page then node id so the list is stable between loads — a picker
 * whose options reshuffle is one people stop trusting.
 */
export async function listForms(ctx: PropertyContext): Promise<FormChoice[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.formDefinition.findMany({
      where: { propertyId: ctx.propertyId },
      select: { formNodeId: true, pageSlug: true, config: true },
      orderBy: [{ pageSlug: 'asc' }, { formNodeId: 'asc' }],
    })
  );
  return rows.map((row) => {
    // The name is the author's, read through the same normalizer the panel and
    // the submit path use, so "unnamed" means the same thing in all three. An
    // empty string is not a name — it is the default the panel never filled in,
    // and letting it through would put a blank option in the picker.
    const name = readSilicaFormConfig(row.config).name.trim();
    return {
      formNodeId: row.formNodeId,
      name: name === '' ? null : name,
      pageSlug: row.pageSlug,
    };
  });
}

/** Save this form's routing. `recipients` is validated by the caller (the route parses
 *  them as emails) — this never accepts an address from a public request, only from an
 *  authenticated editor session. */
export async function saveSilicaForm(
  ctx: PropertyContext,
  formNodeId: string,
  // `config` is deliberately unnormalized: it is normalized on the way IN (below) and
  // on the way OUT (`getSilicaForm`), so a partial blob from an older client, or one
  // field the route didn't know about, still stores a complete, valid config.
  input: { pageSlug: string | null; recipients: string[]; config: unknown }
): Promise<SilicaFormDefinition> {
  const config = readSilicaFormConfig(input.config) as unknown as Prisma.InputJsonValue;
  await withTenant(ctx, (tx) =>
    tx.formDefinition.upsert({
      where: { propertyId_formNodeId: { propertyId: ctx.propertyId, formNodeId } },
      create: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        formNodeId,
        pageSlug: input.pageSlug,
        recipients: input.recipients,
        config,
      },
      update: { pageSlug: input.pageSlug, recipients: input.recipients, config },
    })
  );
  return getSilicaForm(ctx, formNodeId);
}
