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
  collectSilicaFormIds,
  readSilicaFormConfig,
  CONTACT_FORM_TYPE,
  CONTACT_FORM_SECRET_PROPS,
  type BuilderNode,
  type SilicaFormConfig,
} from '@wizeworks/builder-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, TxClient } from '@wizeworks/db';

import type { PropertyContext } from '../errors';
import * as siteService from './site-service';

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
  // A form nobody has configured yet has no row, and therefore no page either —
  // and the panel would then SAVE that null, permanently losing which page the
  // form is on. The site knows; ask it.
  const pageSlug = row?.pageSlug ?? (await formsOnSite(ctx)).get(formNodeId) ?? null;

  return {
    formNodeId,
    pageSlug,
    recipients: row?.recipients ?? [],
    config: readSilicaFormConfig(row?.config),
  };
}

/**
 * Where every live form on this site lives: formNodeId → its page slug.
 *
 * Null means the home page, matching the submit route's convention; a form in the
 * FRAME is on no page in particular and keeps that null too. The frame is walked
 * because a newsletter block in the footer or a header enquiry form submits from
 * every route, exactly as `resolveContactForm` already allows.
 */
async function formsOnSite(ctx: PropertyContext): Promise<Map<string, string | null>> {
  const [site, framed] = await Promise.all([
    siteService.getPublishedSite(ctx),
    siteService.getPublishedFrame(ctx),
  ]);
  const found = new Map<string, string | null>();
  for (const page of site?.pages ?? []) {
    for (const id of collectSilicaFormIds(page.root)) {
      if (!found.has(id)) found.set(id, page.slug ?? null);
    }
  }
  if (framed.frame) {
    for (const id of collectSilicaFormIds(framed.frame.root)) {
      if (!found.has(id)) found.set(id, null);
    }
  }
  return found;
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
 * Read from the PUBLISHED SITE, not from `FormDefinition`. This used to list the
 * rows, and its own comment claimed that was "every form on this site" — it was
 * not. A row is written the first time somebody saves settings for a form, so the
 * list contained exactly the forms that had already been configured. On a site
 * where nothing had been configured (every site, since no screen could configure
 * anything) the picker was empty, which made the settings unreachable and made
 * the campaign picker it was built for permanently offer nothing (issue 355).
 *
 * Distinct from `submissionForms`, which derives its list from SUBMISSIONS and so
 * only knows a form once somebody has filled it in. That is backwards for both
 * callers: you point a campaign at a form, and you decide who gets emailed about
 * a form, BEFORE anyone has used it.
 *
 * The frame is walked as well as the pages — a newsletter block in the footer or
 * a header enquiry form lives in the chrome and submits from every route, exactly
 * as `resolveContactForm` already allows.
 *
 * Ordered by page then node id so the list is stable between loads — a picker
 * whose options reshuffle is one people stop trusting.
 */
export async function listForms(ctx: PropertyContext): Promise<FormChoice[]> {
  const [found, rows] = await Promise.all([
    formsOnSite(ctx),
    withTenant(ctx, (tx) =>
      tx.formDefinition.findMany({
        where: { propertyId: ctx.propertyId },
        select: { formNodeId: true, pageSlug: true, config: true },
      })
    ),
  ]);

  // THE UNION, and both halves are load-bearing.
  //
  // The published site is what makes a form offerable before anyone has touched
  // its settings — reading rows alone meant the picker held exactly the forms
  // that were already configured, and nothing could configure one.
  //
  // The rows are what keeps a form offerable before the site is published. An
  // owner who adds a contact form, names it, and has not pressed Publish yet has
  // a row and no published tree; without this half the picker would be empty for
  // her, which is the same chicken-and-egg wearing different clothes.
  //
  // The site wins on page: it is where the form IS now, while the row records
  // where it was when the settings were last saved.
  for (const row of rows) {
    if (!found.has(row.formNodeId)) found.set(row.formNodeId, row.pageSlug);
  }

  // The name is the author's, read through the same normalizer the panel and the
  // submit path use, so "unnamed" means the same thing in all three. An empty
  // string is not a name — it is the default nobody filled in, and letting it
  // through would put a blank option in the picker.
  const names = new Map<string, string>();
  for (const row of rows) {
    const name = readSilicaFormConfig(row.config).name.trim();
    if (name !== '') names.set(row.formNodeId, name);
  }

  return [...found.entries()]
    .map(([formNodeId, pageSlug]) => ({
      formNodeId,
      name: names.get(formNodeId) ?? null,
      pageSlug,
    }))
    .sort(
      (a, b) =>
        (a.pageSlug ?? '').localeCompare(b.pageSlug ?? '') ||
        a.formNodeId.localeCompare(b.formNodeId)
    );
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
