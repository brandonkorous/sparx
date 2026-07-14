// Legacy sparx page/layout tree → silica `Node` (the onboarding→silica bridge).
//
// Tenant onboarding (`goLiveInstall`, the classic `/story`/`/onboarding` finish)
// has only ever written the LEGACY `BuilderNode` tree (`BuilderPage.publishedTree`
// / `BuilderLayout.publishedTree`). The storefront's home/page/frame routes
// (`apps/site/lib/silica.ts`) read the SILICA columns first and unconditionally —
// so a tenant onboarded through either flow renders the hardcoded generic starter
// instead of their own authored content until this conversion runs once and
// materializes it into `silicaDraftTree`/`silicaPublishedTree` via `siteService`.
//
// It is TOTAL over the node vocabulary tenant-onboarding content actually contains
// (verified against every shipped marketplace-catalog blueprint AND the classic
// `STARTER_PAGES` fallback — see `starters.ts`): raw `el:<tag>` elements (the
// bulk of a blueprint's authored content) plus ~30 named leaf/container types.
// Anything genuinely unrecognized degrades gracefully — a container unwraps to
// its children, a leaf is dropped — rather than guessing, exactly like
// `email-legacy-to-silica.ts`. Every drop is recorded in the returned warnings so
// a conversion is never silently lossy.
//
// Known, accepted simplifications (documented, not bugs): `NavItem` dropdown
// nesting flattens to a link list; `ThemeToggle`/`Map`/`Dialog`/`Lightbox`/a
// standalone `VariantPicker`/`Quantity`/`AddToCart` (outside a `BuyBox`) have no
// silica equivalent yet and are dropped; a `ContactForm`'s live submission wiring
// isn't carried over (renders as a static composed prompt, same as `Signup`).

import {
  action,
  atom,
  bind,
  el,
  outlet,
  repeat,
  type ComponentNode,
  type ElementNode,
  type Node,
} from '@wizeworks/silicaui-html';

import { dataKindFor, encodeBindingRef } from './binding-ref';
import type { Binding, BuilderNode } from './node';
import { legacyBuyBoxToSilica, proseParagraphs } from './silica-page-kit';

type Markable = ElementNode | ComponentNode;

export interface ConversionWarning {
  nodeId: string;
  nodeType: string;
  reason: string;
}

const str = (node: BuilderNode, key: string): string => {
  const v = node.props?.[key];
  return typeof v === 'string' ? v : '';
};

/** Like `str`, but an absent/empty value falls through to `fallback` — for the
 *  handful of authored strings (a nav label, a class override) where "" should
 *  read as "not set" rather than a deliberate empty string. */
const strOr = (node: BuilderNode, key: string, fallback: string): string => {
  const v = str(node, key);
  return v === '' ? fallback : v;
};

const classOr = (node: BuilderNode, fallback: string): string => node.class || fallback; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- an authored EMPTY class string should also fall through to the default, not just undefined.

// ── raw `el:<tag>` attribute projection ───────────────────────────────────────
// Raw-element props ARE the flat attrs bag (docs/98 Pillar 1); silica's own
// `sanitizeElement` re-filters against ITS whitelist at render time, so passing
// through every string/number/boolean prop (renamed where the real HTML
// attribute name differs) is safe — nothing un-sanctioned survives to output.

const ATTR_RENAME: Record<string, string> = {
  ariaLabel: 'aria-label',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  stopColor: 'stop-color',
};
const NON_ATTR_PROP_KEYS = new Set(['text', 'behavior', 'sxRole', 'level', 'variant', 'doc']);

function elementAttrs(props: Record<string, unknown>): Record<string, string | number | boolean> {
  const attrs: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (NON_ATTR_PROP_KEYS.has(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
      continue;
    attrs[ATTR_RENAME[key] ?? key] = value;
  }
  return attrs;
}

// ── binding attach ─────────────────────────────────────────────────────────────

function applyBinding(node: Node, binding: Binding | undefined, allowRepeat: boolean): Node {
  if (!binding) return node;
  const ref = encodeBindingRef(binding);
  const kind = dataKindFor(binding);
  const markable = node as Markable;
  if (kind === 'action') return action(markable, ref, binding.href);
  if (kind === 'collection' && allowRepeat) return repeat(markable, ref);
  return bind(markable, ref);
}

// ── containers ───────────────────────────────────────────────────────────────

const CONTAINER_TAGS: Record<string, string> = {
  Section: 'section',
  Stack: 'div',
  Grid: 'div',
  Card: 'div',
  ProductForm: 'div',
};

function mapChildren(children: BuilderNode[] | undefined, warnings: ConversionWarning[]): Node[] {
  return (children ?? []).flatMap((c) => {
    const mapped = legacyNodeToSilica(c, warnings);
    return mapped ? [mapped] : [];
  });
}

/** One legacy node → its silica equivalent, or null if it (and its subtree, for a
 *  leaf) carries nothing convertible. */
export function legacyNodeToSilica(node: BuilderNode, warnings: ConversionWarning[]): Node | null {
  if (node.type.startsWith('el:')) {
    const tag = node.type.slice(3);
    const textProp = typeof node.props?.text === 'string' ? node.props.text : undefined;
    const children = mapChildren(node.children, warnings);
    const built = el(tag, node.class ?? '', {
      attrs: elementAttrs(node.props ?? {}),
      ...(children.length === 0 && textProp !== undefined ? { text: textProp } : {}),
      ...(children.length > 0 ? { children } : {}),
    });
    return applyBinding(built, node.binding, true);
  }

  switch (node.type) {
    case 'Section':
    case 'Stack':
    case 'Grid':
    case 'Card':
    case 'ProductForm': {
      const built = el(CONTAINER_TAGS[node.type] ?? 'div', node.class ?? '', {
        children: mapChildren(node.children, warnings),
      });
      return applyBinding(built, node.binding, true);
    }
    case 'Outlet':
      return outlet();
    case 'NavMenu':
      return el('nav', classOr(node, 'flex items-center gap-6'), {
        children: mapChildren(node.children, warnings),
      });
    case 'NavItem': {
      const label = str(node, 'label');
      const href = strOr(node, 'href', '#');
      const link = el('a', node.class ?? '', { attrs: { href }, text: label });
      const kids = mapChildren(node.children, warnings);
      // A dropdown flattens to a link group — silica has no CSS-only nav-drop
      // primitive to lower it to; the links stay reachable, just not nested.
      return kids.length ? el('div', 'flex flex-col', { children: [link, ...kids] }) : link;
    }
    case 'AccountMenu':
      return el('a', node.class ?? '', { attrs: { href: '/account' }, text: 'Account' });
    case 'Wordmark':
      // Always reflects the tenant's real identity, regardless of the legacy
      // node's own props — same binding `siteNavbar()`/`siteFooter()` use.
      return bind(
        el('a', classOr(node, 'text-xl font-bold tracking-tight text-base-content'), {
          attrs: { href: '/' },
          text: 'Your site',
        }),
        'site.identity.name'
      );
    case 'SocialLinks': {
      const raw = node.props?.links;
      const items = Array.isArray(raw) ? raw : [];
      const links = items.flatMap((it) => {
        if (!it || typeof it !== 'object') return [];
        const rec = it as Record<string, unknown>;
        const url = typeof rec.url === 'string' ? rec.url : '';
        const platform = typeof rec.platform === 'string' ? rec.platform : '';
        return url
          ? [
              el('a', 'text-base-content/60 hover:text-base-content', {
                attrs: { href: url },
                text: platform,
              }),
            ]
          : [];
      });
      if (links.length === 0) return null;
      return el('div', classOr(node, 'flex items-center gap-4'), { children: links });
    }
    case 'Signup':
      return el('div', classOr(node, 'flex flex-col gap-3'), {
        children: [
          el('p', 'text-base-content/70', { text: 'Get updates by email.' }),
          el('a', 'btn btn-primary', {
            attrs: { href: '/contact' },
            text: strOr(node, 'cta', 'Subscribe'),
          }),
        ],
      });
    case 'ContactForm':
      warnings.push({
        nodeId: node.id,
        nodeType: node.type,
        reason:
          'live contact-form submission not carried over — rendered as a static composed prompt',
      });
      return el('div', classOr(node, 'flex flex-col gap-3'), {
        children: mapChildren(node.children, warnings),
      });
    case 'Field':
      return el('div', classOr(node, 'flex flex-col gap-1.5'), {
        children: mapChildren(node.children, warnings),
      });
    case 'Input':
      return el('input', classOr(node, 'input'), {
        attrs: {
          type: strOr(node, 'type', 'text'),
          name: str(node, 'name'),
          placeholder: str(node, 'placeholder'),
        },
      });
    case 'Textarea':
      return el('textarea', classOr(node, 'textarea'), {
        attrs: { name: str(node, 'name'), placeholder: str(node, 'placeholder') },
      });
    case 'Heading': {
      const level = Number(node.props?.level) || 2;
      const built = atom('Heading', node.class ?? '', {
        level: Math.min(6, Math.max(1, level)),
        text: str(node, 'text'),
      });
      return applyBinding(built, node.binding, false);
    }
    case 'Text': {
      const built = el('p', classOr(node, 'text-base-content/70'), { text: str(node, 'text') });
      return applyBinding(built, node.binding, false);
    }
    case 'Prose': {
      const paragraphs = proseParagraphs(node.props?.doc);
      if (paragraphs.length === 0) return null;
      return el('div', classOr(node, 'flex flex-col gap-3'), {
        children: paragraphs.map((p) => el('p', 'text-base-content/70', { text: p })),
      });
    }
    case 'Button': {
      const href = str(node, 'href');
      const label = strOr(node, 'label', 'Button');
      const built = atom(
        'Button',
        classOr(node, 'btn btn-primary'),
        href ? { href } : { type: strOr(node, 'type', 'button') },
        [label]
      );
      return applyBinding(built, node.binding, false);
    }
    case 'Badge': {
      const built = el('span', classOr(node, 'badge'), {
        text: str(node, 'text') || str(node, 'label'),
      });
      return applyBinding(built, node.binding, false);
    }
    case 'Divider':
      return atom('Divider', node.class ?? '');
    case 'Image':
    case 'ImageDisplay': {
      const built = atom('Image', node.class ?? '', {
        src: str(node, 'src'),
        alt: str(node, 'alt'),
      });
      return applyBinding(built, node.binding, false);
    }
    case 'Icon':
      return atom('Icon', node.class ?? '', { name: strOr(node, 'name', 'star') });
    case 'PriceTag': {
      const built = el('span', classOr(node, 'font-bold text-primary'), { text: '$0.00' });
      return applyBinding(built, node.binding, false);
    }
    case 'Stat': {
      const built = atom('Stat', node.class ?? '', {
        title: str(node, 'label'),
        value: strOr(node, 'value', '0'),
      });
      return applyBinding(built, node.binding, false);
    }
    case 'BuyBox':
      return legacyBuyBoxToSilica();
    case 'Map':
      warnings.push({
        nodeId: node.id,
        nodeType: node.type,
        reason: 'embeds are blocked by the silica security floor — dropped',
      });
      return null;
    case 'VariantPicker':
    case 'Quantity':
    case 'AddToCart':
      warnings.push({
        nodeId: node.id,
        nodeType: node.type,
        reason: 'no standalone silica equivalent — only ships composed inside BuyBox',
      });
      return null;
    case 'ThemeToggle':
    case 'Dialog':
    case 'Lightbox':
      warnings.push({ nodeId: node.id, nodeType: node.type, reason: 'not convertible yet' });
      return null;
    case 'email_wordmark':
    case 'unsubscribe_link':
    case 'physical_address':
      // Email-only nodes; a page tree should never carry these.
      return null;
    default: {
      warnings.push({ nodeId: node.id, nodeType: node.type, reason: 'unrecognized node type' });
      const kids = mapChildren(node.children, warnings);
      return kids.length ? el('div', node.class ?? '', { children: kids }) : null;
    }
  }
}

/** A legacy page/layout root → its silica root. A root that converts to nothing
 *  (every child dropped) becomes an empty, still-valid wrapper div rather than
 *  null — a page must always have SOME root node. */
export function legacyTreeToSilicaRoot(tree: BuilderNode, warnings: ConversionWarning[]): Node {
  const mapped = legacyNodeToSilica(tree, warnings);
  return mapped ?? el('div', tree.class ?? '');
}
