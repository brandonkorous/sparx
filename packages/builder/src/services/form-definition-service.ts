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
  CONTACT_FORM_TYPE,
  CONTACT_FORM_SECRET_PROPS,
  type BuilderNode,
} from '@sparx/builder-schemas';
import type { Prisma, TxClient } from '@sparx/db';

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
