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
    EmailColorDefaults,
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

/** The semantic status colors — FIXED, not brand-derived: a success is green and a
 *  warning is amber regardless of the tenant's palette, and the sparx theme system
 *  models no semantic tokens anyway. Chosen dark enough to read on a light card
 *  (email renders the light palette only). */
const SEMANTIC = {
    info: '#1d4ed8',
    success: '#15803d',
    warning: '#b45309',
    error: '#b91c1c',
} as const;

/** The full role → color map a `*Role` field resolves against (silicaui 0.33). The
 *  surface/brand roles come from the tenant's resolved brand (theme-adaptive); the
 *  semantic roles are the fixed constants above. */
function roleMap(brand: BrandTokens): EmailColorDefaults {
    return {
        primary: brand.primary,
        primaryContent: brand.primaryForeground,
        baseContent: brand.foreground,
        base100: brand.background,
        base200: brand.muted,
        base300: brand.border,
        secondary: brand.accent,
        accent: brand.accent,
        neutral: brand.foreground,
        ...SEMANTIC,
    };
}

/** The role → color map the send paints with, for a resolved brand — exported so the
 *  email STUDIO can feed the SAME map to its canvas (silica's `resolveEmailColorDefaults`
 *  / `setColorDefaults`), so the edit canvas repaints every `*Auto` field in exactly the
 *  colors the send uses. Without this the studio derived canvas colors from the site
 *  PAGE theme (`compileThemeForTenant`), which can diverge from — or fail to resolve at
 *  all against — the email brand, leaving the canvas on silica's neutral defaults (a
 *  black button, no status color) while the real send shipped the brand. */
export function emailBrandColorDefaults(brand: BrandTokens): EmailColorDefaults {
    return roleMap(brand);
}

/** The DARK role → color map, for a brand that carries a `dark` palette (its site's
 *  dark theme). Same shape as the light map, so a diff against `emailBrandColorDefaults`
 *  drives the `@media (prefers-color-scheme: dark)` remap. A brand hue the dark palette
 *  doesn't override falls back to its light value, so it's left unmapped (no remap rule)
 *  — right when the brand keeps its hue across modes. Returns null when the brand has no
 *  dark palette (→ the send emits no dark CSS and renders light everywhere). Semantic
 *  roles stay the FIXED light-readable constants: the theme system models no dark
 *  semantics, so remapping them would mean inventing colors. */
export function emailBrandDarkColorDefaults(brand: BrandTokens): EmailColorDefaults | null {
    const d = brand.dark;
    if (!d) return null;
    return {
        primary: d.primary ?? brand.primary,
        primaryContent: d.primaryForeground ?? brand.primaryForeground,
        baseContent: d.foreground,
        base100: d.background,
        base200: d.muted,
        base300: d.border,
        secondary: d.accent ?? brand.accent,
        accent: d.accent ?? brand.accent,
        neutral: d.foreground,
        ...SEMANTIC,
    };
}

/** Repaint one node's auto-tracking color fields. Every branch is guarded by that
 *  field's own `Auto` flag (so a hand-picked color always survives) and honours the
 *  node's optional `*Role` (0.33) — falling back to that field's historical default
 *  role when unset, so pre-role documents repaint exactly as before. */
function repaint(node: EmailNode, roles: EmailColorDefaults): EmailNode {
    switch (node.kind) {
        case 'text': {
            let n = node;
            if (n.colorAuto) n = { ...n, color: roles[n.colorRole ?? 'baseContent'] };
            if (n.linkColorAuto) n = { ...n, linkColor: roles[n.linkColorRole ?? 'primary'] };
            return n;
        }
        case 'button':
            return {
                ...node,
                ...(node.bgAuto ? { bg: roles[node.bgRole ?? 'primary'] } : {}),
                ...(node.colorAuto ? { color: roles[node.colorRole ?? 'primaryContent'] } : {}),
                ...(node.borderColorAuto ? { borderColor: roles[node.borderColorRole ?? 'primary'] } : {}),
            };
        case 'divider':
            return node.colorAuto ? { ...node, color: roles.base300 } : node;
        case 'section':
            return {
                ...node,
                ...(node.bgAuto ? { bg: roles[node.bgRole ?? 'base100'] } : {}),
                ...(node.borderColorAuto ? { borderColor: roles[node.borderColorRole ?? 'base300'] } : {}),
            };
        default:
            return node;
    }
}

function walkChild(child: LayoutChild, roles: EmailColorDefaults): LayoutChild {
    if (child.kind === 'columns') {
        return {
            ...child,
            children: child.children.map((col) => ({
                ...col,
                children: col.children.map((c) => walkChild(c, roles)),
            })),
        };
    }
    return repaint(child, roles) as LayoutChild;
}

function walkSection(section: SectionNode, roles: EmailColorDefaults): SectionNode {
    const painted = repaint(section, roles) as SectionNode;
    return { ...painted, children: painted.children.map((c) => walkChild(c, roles)) };
}

/** Repaint an email document in `brand`, honoring every node's `*Auto` flags +
 *  `*Role` (0.33). Pure — returns a new document and never mutates the stored one. */
export function applyBrandColors(doc: EmailDocument, brand: BrandTokens): EmailDocument {
    const roles = roleMap(brand);
    const root = doc.root;
    return {
        ...doc,
        root: {
            ...root,
            // The body's canvas tracks base200 (its `bgAuto` default) and its content
            // surface base100 — via the same role map, honoring any explicit role.
            ...(root.bgAuto ? { bg: roles[root.bgRole ?? 'base200'] } : {}),
            ...(root.contentBgAuto ? { contentBg: roles[root.contentBgRole ?? 'base100'] } : {}),
            ...(root.fontFamily === UNSET_FONT ? { fontFamily: brand.fontBody } : {}),
            children: root.children.map((s) => walkSection(s, roles)),
        },
    };
}
