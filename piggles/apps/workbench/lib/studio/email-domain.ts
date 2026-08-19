'use client';

// The one place the email studio reaches into the platform's email vocabulary.
//
// One seam, deliberately: the scope it imports from is being renamed
// (piggles/docs/migration/), and a single import statement makes that a one-line
// change here rather than a sweep through the panes. Everything below is
// re-exported for the rest of the studio to use.
//
// The sample data is EMAIL's, not the site canvas's. On an email
// `customer.firstName` means the person this is being sent to; resolved against
// the site's preview root it would print a plausible wrong name — which is worse
// than raw braces, because nothing about it looks wrong.
//
// The expression evaluator is the platform's own, the SAME one the send uses. A
// second one would let the canvas and the inbox disagree about what a fallback
// means, and a fallback is what stops a nameless customer reading "Hi  — thanks".

import { useMemo } from 'react';
import {
  createSilicaResolver,
  defaultSilicaFormat,
  emailMergeTags,
  groupMergeTags,
  resolveEmailExpression,
  EMAIL_CONTENT_BLOCKS,
  emailSampleData,
  type MergeTag,
} from '@wizeworks/builder-schemas';
import type { EmailPreviewHost } from '@wizeworks/studio/react';
import { useActivePropertyId } from '../api/shell-data';
import { useActiveProperty, useSiteOrigin } from './site-data';
import { useCanvasPreview } from './preview';

export { EMAIL_CONTENT_BLOCKS, emailMergeTags, groupMergeTags, type MergeTag };

/** A resolved value as text, or undefined when there is nothing showable. */
function showable(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  // A number or a flag reads fine; a record or a list does not, and
  // `[object Object]` on a canvas is worse than leaving the tag as authored.
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/** Who the email says it is FROM. Not a sample — the business really is this one. */
export interface EmailSenderIdentity {
  name?: string | null;
  siteUrl?: string | null;
  supportEmail?: string | null;
}

/**
 * The data the email canvas resolves merge tags against.
 *
 * TWO HALVES, and only one of them is a sample. `customer.*` and `order.*` are
 * genuinely hypothetical — the recipient does not exist yet, and Alex Rivera is the
 * honest way to show what the tag will do. `site.*` is not hypothetical at all: it
 * is THIS business, and it is already known.
 *
 * Handing the bare sample through meant a welcome email showed "Acme Supply Co." in
 * six places on a site called Wildroot Flowers. An owner reading that cannot tell
 * whether the merge tag works, whether their business name is set, or whether they
 * are looking at someone else's template — which is the same question the theme
 * board answers by naming the real business on its own preview.
 */
/**
 * The one answer to "who is this email from", for every surface that needs it.
 *
 * A hook rather than a value each caller assembles, because the canvas and the merge-tag
 * reference panel MUST agree — showing `{{site.name}}` as two different businesses on
 * one screen is worse than showing a sample in both.
 */
export function useEmailIdentity(): EmailSenderIdentity {
  const propertyId = useActivePropertyId();
  const property = useActiveProperty(propertyId);
  const origin = useSiteOrigin(propertyId);
  const preview = useCanvasPreview();
  const name = preview.resolve('site.identity.name');
  const siteUrl = origin.data?.origin ?? null;
  const supportEmail = property.data?.settings?.contact?.email ?? null;
  return useMemo(() => ({ name, siteUrl, supportEmail }), [name, siteUrl, supportEmail]);
}

export function useEmailPreview(identity: EmailSenderIdentity): EmailPreviewHost {
  const { name, siteUrl, supportEmail } = identity;
  return useMemo(() => {
    const resolver = createSilicaResolver({
      root: emailSampleData({ name, siteUrl, supportEmail }),
      format: defaultSilicaFormat,
      hideWhenEmpty: true,
    });
    const path = (ref: string) => resolver.resolveBinding(ref, {})?.value;
    return {
      resolveBinding: (ref) => showable(path(ref)),
      resolveExpression: (expr) => resolveEmailExpression(expr, path)?.value,
    };
  }, [name, siteUrl, supportEmail]);
}
