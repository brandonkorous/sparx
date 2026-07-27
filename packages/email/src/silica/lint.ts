// Pre-send checks — the confidence layer under the email studio's "Preview & Check"
// (docs/impl transactional-email). A rendered email can be structurally valid and
// still fail in the inbox in ways a business owner can't see from the canvas: a
// personalization tag typo'd so it renders blank, an image with no description, a
// link that goes nowhere, or a body so large Gmail clips the bottom off. This walks
// the composed document + its projected HTML and returns a plain-language checklist —
// one entry per category, always, so the panel reads as a checklist (green when the
// email is clean, not just "errors when broken").
//
// Runs server-side alongside `renderPreview` (it needs the byte size of the REAL
// projected HTML, and the merge-tag vocabulary from @sparx/builder-schemas). The copy
// is written for a non-technical owner, never dev jargon.

import { EMAIL_CATALOG, parseEmailTokens } from '@sparx/builder-schemas';
import type { SilicaEmailDocument } from '@sparx/builder-schemas';

/** Gmail clips a message once its HTML passes ~102 KB, hiding everything below —
 *  including the footer/unsubscribe — behind a "[Message clipped]" link. Warn well
 *  before the cliff; flag hard once past it. */
const GMAIL_CLIP_BYTES = 102 * 1024;
const GMAIL_WARN_BYTES = 90 * 1024;

export type EmailCheckLevel = 'pass' | 'warning' | 'error';

/** One line of the pre-send checklist. `title` is the category (stable, so the UI can
 *  render a fixed checklist); `detail` explains the finding + the fix in plain terms. */
export interface EmailCheck {
  id: string;
  level: EmailCheckLevel;
  title: string;
  detail: string;
}

export interface LintEmailInput {
  /** The AUTHORED document (pre-frame is fine — the frame is host-composed and always
   *  well-formed). Walked for images, links, and merge-tag paths. */
  doc: SilicaEmailDocument;
  /** The FINAL projected HTML the recipient receives (frame included) — used for the
   *  real byte size, so the clipping check matches what actually ships. */
  html: string;
  subject: string;
  preheader?: string | null;
  /** Link-click tracking context (docs/impl transactional-email Slice 10). Present when
   *  the preview has site context: drives the plain-language "your clicks are tracked"
   *  line + the off-site-link note. Omitted → the tracking check is skipped entirely
   *  (no site to attribute to). */
  tracking?: {
    /** The tenant site host(s) whose links get attributed (lower-cased). */
    hosts: readonly string[];
    /** The campaign name the author's clicks will report under (the email's name). */
    campaign: string;
  };
}

// ── document walk ────────────────────────────────────────────────────────────────

interface AnyNode {
  kind: string;
  children?: AnyNode[];
  [k: string]: unknown;
}

/** Depth-first over every node — sections, column groups, columns, and their leaves
 *  all carry `children`, so one generic walk reaches the whole tree. */
function* walk(node: AnyNode | undefined): Generator<AnyNode> {
  if (!node) return;
  yield node;
  const kids = Array.isArray(node.children) ? node.children : [];
  for (const child of kids) yield* walk(child);
}

// ── merge-tag vocabulary ───────────────────────────────────────────────────────

// The token vocabulary is built straight from the email binding catalog
// (`EMAIL_SOURCES`), which — since docs/impl transactional-email Slice 3 — mirrors
// EXACTLY what the send-time resolver (`api-rest`'s `email-data.ts`) produces. So a
// `{{root.field}}` token can be validated at BOTH levels: an unknown ROOT (`oder`,
// `custmer`) is a source typo, and a known root with an unknown FIELD (`order.totl`)
// is a field typo. Both render blank in the inbox, so both are errors.
//
// One caveat drives the whole shape: ARRAY sources (products, CMS collections) and
// LOOP aliases (`item`) are ITERATED — a field under them belongs to the loop's own
// record, not the flat catalog — so their fields can't be known from a standalone
// token. Those roots are validated at the ROOT only; object sources get the field
// check too. Building the vocabulary from the catalog means a new source/field is
// covered the moment it lands in `EMAIL_SOURCES`, with no second list to sync.

/** root → the field keys valid directly under it, for every OBJECT source (the ones
 *  with a static, knowable field set). Array sources are excluded — they iterate. */
const OBJECT_FIELDS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, ReadonlySet<string>>();
  for (const source of EMAIL_CATALOG.sources) {
    if (source.cardinality !== 'object') continue;
    map.set(source.key, new Set(source.fields.map((f) => f.key)));
  }
  // `tenant` is the historical alias of `site` (an email authored before the
  // `tenant.*`→`site.*` rename): the same fields, plus the back-compat URL aliases
  // (`siteUrl`/`storeUrl`) the resolver still emits under it.
  const site = map.get('site');
  if (site) map.set('tenant', new Set([...site, 'siteUrl', 'storeUrl']));
  return map;
})();

/** Loop aliases + array/dynamic source roots: legitimate as a root, but their fields
 *  come from the iterated record, so a flat token can't be field-checked against them.
 *  Validated at the root only. */
const LOOP_ROOTS: ReadonlySet<string> = new Set(['item', 'items', 'product', 'commerce', 'cms']);

/** Every root a `{{root.field}}` token may legitimately start with. */
const KNOWN_ROOTS: ReadonlySet<string> = new Set<string>([...OBJECT_FIELDS.keys(), ...LOOP_ROOTS]);

/** Collect every string on a node that can carry merge tokens (copy, labels, URLs). */
function tokenBearingStrings(node: AnyNode): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.includes('{{')) out.push(v);
  };
  push(node.html);
  push(node.label);
  push(node.href);
  push(node.src);
  push(node.alt);
  return out;
}

// ── checks ─────────────────────────────────────────────────────────────────────

/** Most inboxes cut the subject off well before here (Gmail shows ~70 on desktop, fewer
 *  on mobile); past this the end reliably never shows. */
const SUBJECT_LONG = 90;

/** Approximate the RENDERED length of a string: each `{{token}}` becomes a nominal short
 *  value (it expands to real data at send), so a token-heavy but visually short subject
 *  isn't mistaken for a long one. */
const TOKEN_RE = /\{\{.*?\}\}/g;
function approxRenderedLength(text: string): number {
  return text.replace(TOKEN_RE, 'XXXXXXXX').trim().length;
}

function checkSubject(subject: string): EmailCheck {
  const trimmed = subject.trim();
  if (trimmed.length === 0) {
    return {
      id: 'subject',
      level: 'error',
      title: 'Subject line',
      detail: 'This email has no subject line — most inboxes show a blank or "(no subject)".',
    };
  }
  if (approxRenderedLength(subject) > SUBJECT_LONG) {
    return {
      id: 'subject',
      level: 'warning',
      title: 'Subject line',
      detail: `"${trimmed}" is long — most inboxes cut the subject off after roughly 60–90 characters, so the end may never show. A shorter subject reads in full.`,
    };
  }
  return { id: 'subject', level: 'pass', title: 'Subject line', detail: `"${trimmed}"` };
}

function checkPreheader(preheader: string | null | undefined): EmailCheck {
  const ok = (preheader ?? '').trim().length > 0;
  return {
    id: 'preheader',
    level: ok ? 'pass' : 'warning',
    title: 'Preview text',
    detail: ok
      ? 'The line shown after the subject in the inbox is set.'
      : 'No preview text. This is the grey line after the subject in the inbox — adding one lifts open rates.',
  };
}

function checkLinks(nodes: AnyNode[]): EmailCheck {
  const dead: string[] = [];
  const placeholder: string[] = [];
  for (const n of nodes) {
    if (n.kind !== 'button' && n.kind !== 'video') continue;
    const href = typeof n.href === 'string' ? n.href.trim() : '';
    const label = n.kind === 'button' && typeof n.label === 'string' ? n.label.trim() : '';
    const name = label || (n.kind === 'video' ? 'video link' : 'a button');
    if (href === '' || href === '#') dead.push(name);
    else if (/example\.(com|org|net)/i.test(href)) placeholder.push(name);
  }
  if (dead.length > 0) {
    return {
      id: 'links',
      level: 'error',
      title: 'Links',
      detail: `${plural(dead.length, 'link goes', 'links go')} nowhere: ${list(dead)}. Add a destination or remove it.`,
    };
  }
  if (placeholder.length > 0) {
    return {
      id: 'links',
      level: 'warning',
      title: 'Links',
      detail: `${plural(placeholder.length, 'link still points', 'links still point')} at a placeholder address: ${list(placeholder)}.`,
    };
  }
  return {
    id: 'links',
    level: 'pass',
    title: 'Links',
    detail: 'Every button and link has a real destination.',
  };
}

function checkImages(nodes: AnyNode[]): EmailCheck {
  let total = 0;
  let missing = 0;
  for (const n of nodes) {
    if (n.kind !== 'image') continue;
    // A decorative image can legitimately have no src yet in a draft; only count real
    // images toward the description check.
    if (typeof n.src !== 'string' || n.src.trim() === '') continue;
    total += 1;
    if (typeof n.alt !== 'string' || n.alt.trim() === '') missing += 1;
  }
  if (total === 0) {
    return {
      id: 'images',
      level: 'pass',
      title: 'Image descriptions',
      detail: 'No images to describe.',
    };
  }
  if (missing > 0) {
    return {
      id: 'images',
      level: 'warning',
      title: 'Image descriptions',
      detail: `${plural(missing, 'image has', 'images have')} no description. Many people (and every inbox that blocks images by default) see the description instead — add alt text.`,
    };
  }
  return {
    id: 'images',
    level: 'pass',
    title: 'Image descriptions',
    detail: `All ${total} image${total === 1 ? '' : 's'} have a description.`,
  };
}

/** Link/button labels that tell a reader NOTHING about where they go — worst on a screen
 *  reader, which lists an email's links out of context ("click here, click here, here").
 *  A tight set on purpose, so a real CTA ("View your order", "Read more") is never flagged. */
const VAGUE_LABELS: ReadonlySet<string> = new Set([
  'click here',
  'here',
  'click',
  'link',
  'this',
  'this link',
]);

/** A label reduced to its bare visible words — tags + tokens stripped, trailing arrows /
 *  punctuation removed, lowercased — for matching against the vague set. */
function normalizeLabel(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(TOKEN_RE, '')
    .replace(/[\s.!?→›»]+$/g, '')
    .trim()
    .toLowerCase();
}

/** The visible text of every `<a>` inside a text node's html. */
function anchorTexts(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1] ?? '');
  return out;
}

function checkLinkText(nodes: AnyNode[]): EmailCheck {
  const isVague = (raw: string): boolean => {
    const label = normalizeLabel(raw);
    if (label === '') return false;
    if (VAGUE_LABELS.has(label)) return true;
    // A bare URL as the visible text reads as gibberish aloud and looks like spam.
    return /^(https?:\/\/|www\.)/i.test(label);
  };
  const vague: string[] = [];
  for (const n of nodes) {
    if (n.kind === 'button' && typeof n.label === 'string' && isVague(n.label)) {
      vague.push(n.label.trim());
    }
    if (n.kind === 'text' && typeof n.html === 'string') {
      for (const t of anchorTexts(n.html)) {
        if (isVague(t)) vague.push(normalizeLabel(t) || t.trim());
      }
    }
  }
  if (vague.length > 0) {
    return {
      id: 'link-text',
      level: 'warning',
      title: 'Link wording',
      detail: `${plural(vague.length, 'link says', 'links say')} something that doesn't describe where it goes: ${list(vague)}. Name a link after its destination ("View your order") so it makes sense on its own — screen readers read links out of context.`,
    };
  }
  return {
    id: 'link-text',
    level: 'pass',
    title: 'Link wording',
    detail: 'Every link says where it goes.',
  };
}

/** The readable text of the whole email — text-node copy (tags + tokens stripped) plus
 *  button labels. What a person actually reads, and what an inbox with images off is left
 *  with. */
function readableTextLength(nodes: AnyNode[]): number {
  let len = 0;
  for (const n of nodes) {
    if (n.kind === 'text' && typeof n.html === 'string') {
      len += n.html
        .replace(/<[^>]*>/g, '')
        .replace(TOKEN_RE, 'XXXXXXXX')
        .trim().length;
    } else if (n.kind === 'button' && typeof n.label === 'string') {
      len += n.label.trim().length;
    }
  }
  return len;
}

/** An email that is almost all image with little text: inboxes block images by default and
 *  spam filters distrust image-only mail, so it can arrive blank. Only fires when there ARE
 *  content images (the wordmark/footer live in the host frame, not here) and the copy is
 *  genuinely sparse — a text-led email always passes. */
const MIN_TEXT_WITH_IMAGES = 40;
function checkImageText(nodes: AnyNode[]): EmailCheck {
  const images = nodes.filter(
    (n) => n.kind === 'image' && typeof n.src === 'string' && n.src.trim() !== ''
  ).length;
  const textLen = readableTextLength(nodes);
  if (images === 0 || textLen >= MIN_TEXT_WITH_IMAGES) {
    return {
      id: 'image-text',
      level: 'pass',
      title: 'Text and images',
      detail:
        images === 0
          ? 'This email reads as text, so it still works when images are turned off.'
          : 'A healthy balance of text and images.',
    };
  }
  return {
    id: 'image-text',
    level: 'warning',
    title: 'Text and images',
    detail:
      'This email is almost all image with very little text. Many inboxes block images by default and spam filters distrust image-only mail, so it can arrive blank — add real text (a heading and a line or two) alongside the pictures.',
  };
}

/** The href of every `<a>` inside a text node's html. */
function anchorHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push((m[1] ?? '').replace(/&amp;/g, '&'));
  return out;
}

/** An author link is OFF-SITE — unmeasurable by the tenant's own analytics — when it's a
 *  concrete absolute http(s) URL to some other host. A site-relative link, or one built
 *  from a `{{token}}` (an order/product URL, which resolves to the tenant's own site), is
 *  treated as on-site: those are what tracking exists for. `mailto:`/`tel:`/anchors carry
 *  no click to a page, so they don't count either way. */
function classifyAuthorLink(
  href: string,
  hosts: readonly string[]
): 'on-site' | 'off-site' | 'none' {
  const h = href.trim();
  if (h === '' || h === '#' || /^(mailto:|tel:|sms:)/i.test(h)) return 'none';
  if (h.includes('{{')) return 'on-site'; // a token URL resolves to the tenant site.
  let url: URL;
  try {
    url = new URL(h);
  } catch {
    return 'on-site'; // relative → same site.
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'none';
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return hosts.some((x) => x.toLowerCase().replace(/^www\./, '') === host) ? 'on-site' : 'off-site';
}

/** The plain-language "your clicks are counted" line (docs/impl transactional-email
 *  Slice 10). Reassures the owner that every on-site link is measured under the email's
 *  campaign, and notes any off-site links their reports can't follow. Always informational
 *  (a pass) — an off-site link (a shipping carrier, a social profile) is normal, not a
 *  mistake — the point is that they KNOW which clicks show up in their reports. */
function checkLinkTracking(
  nodes: AnyNode[],
  tracking: NonNullable<LintEmailInput['tracking']>
): EmailCheck {
  let onSite = 0;
  let offSite = 0;
  const classify = (href: string) => {
    const kind = classifyAuthorLink(href, tracking.hosts);
    if (kind === 'on-site') onSite += 1;
    else if (kind === 'off-site') offSite += 1;
  };
  for (const n of nodes) {
    if (
      (n.kind === 'button' || n.kind === 'image' || n.kind === 'video') &&
      typeof n.href === 'string'
    ) {
      classify(n.href);
    }
    if (n.kind === 'text' && typeof n.html === 'string') {
      for (const href of anchorHrefs(n.html)) classify(href);
    }
  }

  const offNote =
    offSite > 0
      ? ` ${plural(offSite, 'link goes', 'links go')} to another website, which your reports can't follow.`
      : '';

  if (onSite === 0 && offSite === 0) {
    return {
      id: 'link-tracking',
      level: 'pass',
      title: 'Click tracking',
      detail: 'This email has no links to track yet.',
    };
  }
  if (onSite === 0) {
    return {
      id: 'link-tracking',
      level: 'pass',
      title: 'Click tracking',
      detail: `Every link in this email goes to another website, so clicks won't show in your reports.${offNote}`,
    };
  }
  return {
    id: 'link-tracking',
    level: 'pass',
    title: 'Click tracking',
    detail: `${plural(onSite, 'link is', 'links are')} tracked — clicks show in your reports under "${tracking.campaign}".${offNote}`,
  };
}

function checkMergeTags(
  nodes: AnyNode[],
  subject: string,
  preheader: string | null | undefined
): EmailCheck {
  const strings = [subject, preheader ?? '', ...nodes.flatMap(tokenBearingStrings)];
  const unknown = new Set<string>();
  for (const s of strings) {
    for (const tok of parseEmailTokens(s)) {
      const segs = tok.path
        .trim()
        .split('.')
        .map((p) => p.trim());
      const root = segs[0] ?? '';
      if (!root) continue;
      if (!KNOWN_ROOTS.has(root)) {
        unknown.add(tok.raw.trim()); // source typo — `{{oder.total}}`
        continue;
      }
      // Field typo — a real source, a field it doesn't have (`{{order.totl}}`). Only
      // object sources carry a checkable field set; loop/array roots skip this.
      const fields = OBJECT_FIELDS.get(root);
      const field = segs[1] ?? '';
      if (fields && field && !fields.has(field)) unknown.add(tok.raw.trim());
    }
  }
  if (unknown.size > 0) {
    return {
      id: 'merge-tags',
      level: 'error',
      title: 'Personalization tags',
      detail: `${plural(unknown.size, "tag doesn't", "tags don't")} match a personalization field and will render blank: ${list([...unknown])}. Check the spelling against the Merge tags list.`,
    };
  }
  return {
    id: 'merge-tags',
    level: 'pass',
    title: 'Personalization tags',
    detail: 'Every personalization tag matches a known source.',
  };
}

function checkSize(html: string): EmailCheck {
  const bytes = Buffer.byteLength(html, 'utf8');
  const kb = Math.round(bytes / 1024);
  if (bytes >= GMAIL_CLIP_BYTES) {
    return {
      id: 'size',
      level: 'error',
      title: 'Email size',
      detail: `At ${kb} KB this is over Gmail's 102 KB limit — Gmail will hide the bottom (including the unsubscribe footer) behind a "view entire message" link. Trim content or shorten the copy.`,
    };
  }
  if (bytes >= GMAIL_WARN_BYTES) {
    return {
      id: 'size',
      level: 'warning',
      title: 'Email size',
      detail: `At ${kb} KB this is close to Gmail's 102 KB limit, past which Gmail clips the bottom of the message.`,
    };
  }
  return {
    id: 'size',
    level: 'pass',
    title: 'Email size',
    detail: `${kb} KB — well under Gmail's 102 KB clipping limit.`,
  };
}

// ── formatting helpers ─────────────────────────────────────────────────────────

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/** A short human list, capped so a wall of items can't blow out the detail line. */
function list(items: string[], max = 3): string {
  const shown = items.slice(0, max).map((s) => `"${s}"`);
  const extra = items.length - shown.length;
  return extra > 0 ? `${shown.join(', ')} +${extra} more` : shown.join(', ');
}

/**
 * Run every pre-send check and return the checklist, most-severe first (errors, then
 * warnings, then passes) so the UI can lead with what needs attention. Always returns
 * one entry per category — the caller renders it as a checklist, not an error log.
 */
export function lintEmailRender(input: LintEmailInput): EmailCheck[] {
  const nodes = [...walk(input.doc.root as unknown as AnyNode)];
  const checks: EmailCheck[] = [
    checkSubject(input.subject),
    checkPreheader(input.preheader),
    checkLinks(nodes),
    checkLinkText(nodes),
    checkImages(nodes),
    checkImageText(nodes),
    checkMergeTags(nodes, input.subject, input.preheader),
    checkSize(input.html),
  ];
  // Only when the preview carries site context — otherwise there's no site to attribute
  // clicks to and the line would be meaningless.
  if (input.tracking) checks.push(checkLinkTracking(nodes, input.tracking));
  const rank: Record<EmailCheckLevel, number> = { error: 0, warning: 1, pass: 2 };
  return checks.sort((a, b) => rank[a.level] - rank[b.level]);
}
