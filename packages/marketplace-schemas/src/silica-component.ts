// The silica-native marketplace component payload (docs/60 §6, docs/118). A
// marketplace component is now ONE of sparx's silica catalog SECTIONS surfaced
// publicly — a `@wizeworks/silicaui-html` node tree the storefront/builder render
// verbatim — NOT the retired legacy `BuilderNode` component. Like the theme shelf,
// the marketplace is a DISCOVERY surface: each row points at a section that already
// lives in the Builder's Insert palette (by slug), so "Start with this component"
// hands the visitor to onboarding and the Builder inserts it via the existing path
// — the catalog never runs a second renderer.
//
// The tree is stored IN the row and rendered as a LIVE in-browser preview (the same
// posture as the theme shelf), so a bundle ships no baked image. This package stays
// Zod-only: rather than mirror silicaui-html's full recursive `Node` union here, the
// payload is validated loosely — a first-party, trusted tree whose real consumer is
// `renderSilicaBody`. Mirrors `SilicaTreeInput` in @sparx/builder-schemas.

import { z } from 'zod';

/** A silica node — validated loosely (any object carrying a string `kind`
 *  discriminator; children/props/markers pass through verbatim). The exact union
 *  lives in `@wizeworks/silicaui-html`; `renderSilicaBody` is the real validator. */
export const SilicaComponentTree = z.looseObject({ kind: z.string() });

/** A marketplace component's stored payload: the section's silica node tree. */
export const SilicaComponentPayload = z
  .object({
    tree: SilicaComponentTree,
  })
  .strict();
export type SilicaComponentPayload = z.infer<typeof SilicaComponentPayload>;

/** Tolerant read: parse an untrusted `tree` JSON into a renderable silica node, or
 *  null if it isn't one. Used by the adapter to narrow the stored row column for the
 *  live preview (a legacy/hand-edited row may hold a legacy BuilderNode or NULL). */
export function readSilicaComponentTree(input: unknown): Record<string, unknown> | null {
  const parsed = SilicaComponentTree.safeParse(input);
  return parsed.success ? parsed.data : null;
}
