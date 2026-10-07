// Plain-text alternative for a silica email (docs/120 D2). Mailgun requires a text
// part on every send; silica's `toEmailHtml` produces only HTML, so we derive text
// from the RESOLVED node tree directly — more faithful than stripping the projected
// table HTML, and dependency-free. Walk the closed email schema in document order,
// pulling the human-readable text out of each leaf.

import type { EmailDocument, EmailNode } from '@wizeworks/silicaui-builder/email';

// Every named entity the platform's own chrome or a typical body writes. The
// frame separates its footer links with `&middot;`, which was not here, so the
// plain-text copy of every email read "Your account (…) &middot; Privacy Policy"
// (sparx persona issue 143). Numeric entities are decoded generally below.
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  bull: '•',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
  times: '×',
  deg: '°',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body.startsWith('#')) {
      const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** Inline-safe HTML (a `text`/`html` node's body) → plain text: links become
 *  `label (url)`, `<br>` becomes a newline, other tags are dropped, entities
 *  decoded, runs of spaces collapsed. */
function stripInline(html: string): string {
  const withLinks = html.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi,
    (_m, href: string, label: string) => `${label} (${href})`
  );
  const withBreaks = withLinks.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
  const noTags = withBreaks.replace(/<[^>]+>/g, '');
  return decodeEntities(noTags)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function childrenText(nodes: readonly EmailNode[]): string {
  return nodes
    .map(nodeText)
    .filter((t) => t.length > 0)
    .join('\n\n');
}

/** One node → its plain-text contribution. Containers recurse; leaves emit their
 *  own text; purely-visual leaves (divider/spacer) emit nothing. */
function nodeText(node: EmailNode): string {
  switch (node.kind) {
    case 'body':
    case 'section':
    case 'column':
      return childrenText(node.children);
    case 'columns':
      return childrenText(node.children);
    case 'text':
      return stripInline(node.html);
    case 'html':
      return stripInline(node.html);
    case 'button':
      return `${node.label} <${node.href}>`;
    case 'image':
      return node.alt ?? '';
    case 'social':
      return node.links.map((l) => `${l.platform}: ${l.url}`).join('\n');
    case 'video':
      return node.href;
    case 'divider':
    case 'spacer':
      return '';
    default:
      return '';
  }
}

/** The email's plain-text body — the resolved document walked in order. */
export function emailDocumentToText(doc: EmailDocument): string {
  return nodeText(doc.root);
}
