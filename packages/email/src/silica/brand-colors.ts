// Repaint a silica email document in the tenant's brand (docs/120 slice 6).
//
// silica's colors are per-node values, not CSS custom properties — email HTML has no
// `[data-theme]` or `var()` to lean on (Outlook and Gmail don't support them), so a
// theme can only reach an email by REWRITING the node values. silica's editor does
// exactly that on the canvas (`setColorDefaults`), driven by the `*Auto` flags each
// node carries: a field with its `Auto` flag set still tracks the theme, and the
// moment an author picks a color by hand the flag clears and that field freezes.
//
// This is the SEND-time half of the same idea, and it's why the ~24 provisioned
// defaults can be authored once, engine-neutral, with no tenant in scope: they ship in
// silica's neutral palette with every `Auto` flag set, and each send repaints them
// from that tenant's (and that site's) resolved brand. It also means a brand change
// reaches every already-provisioned email immediately — no re-provisioning, and no
// stale copy of the old palette sitting in the database.

import type {
  EmailDocument,
  EmailNode,
  LayoutChild,
  SectionNode,
} from '@wizeworks/silicaui-builder/email';

import type { BrandTokens } from '../components/brand';

/** The `fontFamily` every unedited document carries — silica's own
 *  `emptyEmailDocument` default, which `silica-email-kit` matches deliberately. There
 *  is no `fontAuto` flag in the schema, so this string IS the "untouched" signal: swap
 *  it for the brand's body font, and leave any other value (an author's real choice)
 *  exactly as they set it. */
const UNSET_FONT = 'Arial, Helvetica, sans-serif';

/** Repaint one node's auto-tracking color fields. Every branch is guarded by that
 *  field's own `Auto` flag, so a hand-picked color always survives. */
function repaint(node: EmailNode, brand: BrandTokens): EmailNode {
  switch (node.kind) {
    case 'text':
      return node.colorAuto ? { ...node, color: brand.foreground } : node;
    case 'button':
      return {
        ...node,
        ...(node.bgAuto ? { bg: brand.primary } : {}),
        ...(node.colorAuto ? { color: brand.primaryForeground } : {}),
      };
    case 'divider':
      return node.colorAuto ? { ...node, color: brand.border } : node;
    case 'section':
      return node.bgAuto ? { ...node, bg: brand.background } : node;
    default:
      return node;
  }
}

function walkChild(child: LayoutChild, brand: BrandTokens): LayoutChild {
  if (child.kind === 'columns') {
    return {
      ...child,
      children: child.children.map((col) => ({
        ...col,
        children: col.children.map((c) => walkChild(c, brand)),
      })),
    };
  }
  return repaint(child, brand) as LayoutChild;
}

function walkSection(section: SectionNode, brand: BrandTokens): SectionNode {
  const painted = repaint(section, brand) as SectionNode;
  return { ...painted, children: painted.children.map((c) => walkChild(c, brand)) };
}

/** Repaint an email document in `brand`, honoring every node's `*Auto` flags. Pure —
 *  returns a new document and never mutates the stored one. */
export function applyBrandColors(doc: EmailDocument, brand: BrandTokens): EmailDocument {
  const root = doc.root;
  return {
    ...doc,
    root: {
      ...root,
      ...(root.bgAuto ? { bg: brand.muted } : {}),
      ...(root.contentBgAuto ? { contentBg: brand.background } : {}),
      ...(root.fontFamily === UNSET_FONT ? { fontFamily: brand.fontBody } : {}),
      children: root.children.map((s) => walkSection(s, brand)),
    },
  };
}
