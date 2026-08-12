// The shared marketing-email builder for blueprint starters.
//
// Every blueprint's welcome / win-back / re-book email routes through here, and here
// routes through the platform's own silica email KIT (`@sparx/builder-schemas`) — the
// same `copyBlock` / `heading` / `para` / `button` / `featureList` / `calloutCard` the
// keyed transactional defaults use. So a blueprint's marketing email is built to the
// SAME elevated standard as an order confirmation, and inherits every future kit
// improvement for free. This replaces three hand-rolled `emailDoc` duplicates (one per
// harness) that produced a bare heading-paragraphs-button email (RULE #1: one builder,
// not four).
//
// Relative import, not the package name: marketplace-catalog has no node_modules, so the
// gen scripts import packages by path (see any `gen-*.ts` header). The kit is runtime-
// pure (its only external imports are `type`-only from silicaui), so tsx erases them.

import {
  button,
  calloutCard,
  copyBlock,
  emailDoc,
  featureList,
  heading,
  para,
  text,
} from '../../../packages/builder-schemas/src/silica-email-kit';

export interface BlueprintEmail {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  /** An optional benefits list — a `featureList` card (title over readable prose). The
   *  "here's what you get" substance a welcome earns beyond a lone paragraph. */
  features?: { title: string; body: string }[];
  /** An optional single highlight — a `calloutCard` (bold line + prose). The "why come
   *  back" nudge a win-back / re-book leans on. */
  highlight?: { title: string; body: string };
  button: { label: string; href: string };
}

/** Build one blueprint marketing email as a silica `EmailDocument`, returned as the
 *  plain JSON shape the harnesses emit into `emails.json`. Colors come out on the kit's
 *  `*Auto` neutral defaults, so the send + the editor canvas both repaint them to the
 *  tenant brand. */
export function blueprintEmailDoc(o: BlueprintEmail): Record<string, unknown> {
  const body = [copyBlock([heading(o.heading), ...o.paragraphs.map((p) => para(p))])];
  if (o.features && o.features.length > 0) body.push(featureList(o.features));
  if (o.highlight) {
    body.push(
      calloutCard([text(o.highlight.title, { size: 18, weight: 'bold' }), text(o.highlight.body)])
    );
  }
  body.push(copyBlock([button(o.button.label, o.button.href, 'left')]));
  return emailDoc(o.subject, o.preheader, body) as unknown as Record<string, unknown>;
}
