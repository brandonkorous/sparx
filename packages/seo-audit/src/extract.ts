// Content-signal extraction (docs/50 §7) — pure structural walkers over the two
// authored structures sparx stores: a Builder node tree and a CMS rich-text doc.
// Both operate on `unknown` JSON (no dependency on the builder/CMS schemas) and
// return the same `ContentSignals` the audit engine consumes, so the H1/alt/
// word/link logic is unit-tested here rather than buried in the API route.

import type { ContentSignals } from './types';

function emptySignals(): ContentSignals {
  return { h1Count: 0, wordCount: 0, imageCount: 0, imagesMissingAlt: 0, internalLinkCount: 0 };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

// A link is "internal" when it stays on this site: a root-relative or relative
// path. Protocol-relative (`//host`), absolute (`https:`/`mailto:`/`tel:`), and
// bare in-page anchors (`#…`) are not counted toward internal linking.
function isInternalHref(href: string): boolean {
  const h = href.trim();
  if (!h || h.startsWith('//') || h.startsWith('#')) return false;
  if (h.startsWith('/')) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return false; // has a URL scheme
  return true; // relative path
}

// ── Builder node tree (apps/dashboard registry types) ─────────────────────────
//
// Heading carries `props.level` ('h1' | 'h2' | …) + `props.text`; Text/Button/
// Badge/Stat hold visible copy in `props.text` / `label` / `value`; Image holds
// `props.alt`; Button holds `props.href`. Background images (`box.backgroundImage`)
// are treated as decorative and don't count toward alt-text coverage.

export function extractBuilderTreeSignals(tree: unknown): ContentSignals {
  const out = emptySignals();
  walkBuilder(tree, out);
  return out;
}

function walkBuilder(node: unknown, out: ContentSignals): void {
  const n = asRecord(node);
  if (!n) return;
  const type = str(n.type);
  const props = asRecord(n.props) ?? {};

  switch (type) {
    case 'Heading':
      if (str(props.level) === 'h1') out.h1Count += 1;
      out.wordCount += countWords(str(props.text));
      break;
    case 'Text':
      out.wordCount += countWords(str(props.text));
      break;
    case 'Stat':
      out.wordCount += countWords(str(props.value)) + countWords(str(props.label));
      break;
    case 'Badge':
      out.wordCount += countWords(str(props.label));
      break;
    case 'Button': {
      out.wordCount += countWords(str(props.label));
      const href = str(props.href);
      if (href && isInternalHref(href)) out.internalLinkCount += 1;
      break;
    }
    case 'Image':
      out.imageCount += 1;
      if (countWords(str(props.alt)) === 0) out.imagesMissingAlt += 1;
      break;
    default:
      break;
  }

  for (const child of asArray(n.children)) walkBuilder(child, out);
}

// ── silica node tree (@wizeworks/silicaui-html) ───────────────────────────────
//
// The shape the CURRENT builder writes, and the one that actually reaches visitors.
// Structurally different from the legacy tree above, which is why grading a silica page
// with `extractBuilderTreeSignals` returned zeroes for everything: no `type: 'Heading'`
// node exists, so every page scored 0 H1s, 0 words and 0 links no matter what was on it.
//
//   · `{kind:'element', tag:'h1'|'a'|'img'|…, attrs, children}` — text lives in
//     `children` as plain STRINGS, not in a `text` prop.
//   · `{kind:'component', component:'Button'|'Image'|…, props}` — silica atoms; the
//     visible words are in `props.label` / `props.text` / `props.children`.
//   · `{kind:'outlet'}` / `{kind:'host', …}` — structural or host-owned; they carry no
//     authored copy of their own, so they contribute nothing.
//
// Bound nodes (`data`) are counted as authored structure but their RESOLVED text is not
// available here — a product template's title comes from the record at render time. That
// is honest rather than wrong: the template's own words are what the author controls.

/** Attribute/prop lookup that tolerates either casing silica emits. */
function attr(bag: Record<string, unknown>, key: string): string {
  return str(bag[key]);
}

/** Words visible on a component node — silica atoms carry copy in props, not children. */
function componentWords(props: Record<string, unknown>): number {
  return (
    countWords(str(props.label)) +
    countWords(str(props.text)) +
    countWords(str(props.title)) +
    countWords(str(props.heading))
  );
}

export function extractSilicaTreeSignals(tree: unknown): ContentSignals {
  const out = emptySignals();
  walkSilica(tree, out);
  return out;
}

function walkSilica(node: unknown, out: ContentSignals): void {
  // A text child is a bare string — the primary way silica carries copy.
  if (typeof node === 'string') {
    out.wordCount += countWords(node);
    return;
  }
  const n = asRecord(node);
  if (!n) return;

  const kind = str(n.kind);
  if (kind === 'element') {
    const tag = str(n.tag).toLowerCase();
    const attrs = asRecord(n.attrs) ?? {};
    if (tag === 'h1') out.h1Count += 1;
    if (tag === 'img') {
      out.imageCount += 1;
      if (countWords(attr(attrs, 'alt')) === 0) out.imagesMissingAlt += 1;
    }
    if (tag === 'a') {
      const href = attr(attrs, 'href');
      if (href && isInternalHref(href)) out.internalLinkCount += 1;
    }
  } else if (kind === 'component') {
    const props = asRecord(n.props) ?? {};
    out.wordCount += componentWords(props);
    const component = str(n.component);
    if (component === 'Image' || component === 'Avatar') {
      out.imageCount += 1;
      if (countWords(str(props.alt)) === 0) out.imagesMissingAlt += 1;
    }
    // A silica `Button`/`Link` atom carries its destination in props, not attrs.
    const href = str(props.href);
    if (href && isInternalHref(href)) out.internalLinkCount += 1;
  }

  for (const child of asArray(n.children)) walkSilica(child, out);
}

// ── CMS rich-text doc (TipTap / ProseMirror) ──────────────────────────────────
//
// Mirrors the node walk in `@sparx/cms-editor`'s `renderDocToHtml`: `heading`
// (numeric `attrs.level`), `text` (with `link` marks), `image`/`sparxImage`
// (`attrs.alt`), and `sparxReference` (an internal entry link).

// A ContentEntry's `body` is a FIELD BAG (validated against the type's schema),
// not a doc itself — the rich-text doc lives in one of its fields (and a type can
// have several). So accept either a `{type:'doc'}` directly or any object/array
// containing docs, and accumulate signals across all of them.
export function extractCmsDocSignals(value: unknown): ContentSignals {
  const out = emptySignals();
  for (const doc of findDocs(value, 0)) {
    for (const child of asArray(doc.content)) walkCms(child, out);
  }
  return out;
}

function findDocs(value: unknown, depth: number): Record<string, unknown>[] {
  if (depth > 4) return [];
  const rec = asRecord(value);
  if (rec) {
    // A TipTap doc — collect it and don't descend (its children are content nodes).
    if (str(rec.type) === 'doc' && Array.isArray(rec.content)) return [rec];
    const found: Record<string, unknown>[] = [];
    for (const v of Object.values(rec)) found.push(...findDocs(v, depth + 1));
    return found;
  }
  if (Array.isArray(value)) {
    const found: Record<string, unknown>[] = [];
    for (const v of value) found.push(...findDocs(v, depth + 1));
    return found;
  }
  return [];
}

function walkCms(node: unknown, out: ContentSignals): void {
  const n = asRecord(node);
  if (!n) return;
  const type = str(n.type);

  if (type === 'text') {
    out.wordCount += countWords(str(n.text));
    for (const mark of asArray(n.marks)) {
      const m = asRecord(mark);
      if (m && str(m.type) === 'link') {
        const href = str(asRecord(m.attrs)?.href);
        if (href && isInternalHref(href)) out.internalLinkCount += 1;
      }
    }
    return;
  }

  const attrs = asRecord(n.attrs) ?? {};
  if (type === 'heading') {
    if (Number(attrs.level) === 1) out.h1Count += 1;
  } else if (type === 'image' || type === 'sparxImage') {
    out.imageCount += 1;
    if (countWords(str(attrs.alt)) === 0) out.imagesMissingAlt += 1;
  } else if (type === 'sparxReference') {
    out.internalLinkCount += 1;
  }

  for (const child of asArray(n.content)) walkCms(child, out);
}
