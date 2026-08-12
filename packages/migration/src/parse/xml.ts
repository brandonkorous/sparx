// A small XML reader, scoped to what export files actually contain.
//
// This is NOT a general XML implementation and does not try to be — no DTDs, no
// entities beyond the five predefined ones plus numeric escapes, no namespace
// resolution (prefixes are kept verbatim, because WXR's `wp:post_id` is easier to
// read than a resolved URI and every consumer here wants the literal name).
//
// It exists because the alternative is a dependency, and the only XML this package
// will ever meet is WordPress eXtended RSS — which Squarespace and WooCommerce also
// emit, since both cloned WordPress's exporter. WXR is machine-generated, always
// well-formed, and wraps essentially every value in CDATA. A ~200-line reader covers
// it completely; a general parser would cover it and 400KB of things we never use.
//
// Trade-off recorded deliberately: if we ever need to read hand-authored XML from a
// tenant, this is the wrong tool and should be replaced rather than extended.

export interface XmlNode {
  /** Tag name including any prefix, e.g. `wp:post_id`. */
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Concatenated direct text + CDATA, whitespace-trimmed. */
  text: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Resolve the predefined entities plus `&#NN;` / `&#xNN;`. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    attrs[match[1]!] = decodeEntities(match[3] ?? match[4] ?? '');
  }
  return attrs;
}

/**
 * Parse a document into a node tree.
 *
 * Returns the root element. Text and CDATA are accumulated onto the nearest open
 * element, so `<title><![CDATA[Hello]]></title>` and `<title>Hello</title>` are
 * indistinguishable downstream — which is what WXR consumers want, since WordPress
 * chooses between the two per-field for reasons of its own.
 */
export function parseXml(source: string): XmlNode | null {
  const root: XmlNode = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;

  const top = (): XmlNode => stack[stack.length - 1]!;

  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt === -1) {
      top().text += decodeEntities(source.slice(i));
      break;
    }
    if (lt > i) top().text += decodeEntities(source.slice(i, lt));

    // CDATA — the common case in WXR, and the reason text is accumulated rather
    // than replaced: a field can be `<![CDATA[a]]> and <![CDATA[b]]>`.
    if (source.startsWith('<![CDATA[', lt)) {
      const end = source.indexOf(']]>', lt);
      const stop = end === -1 ? source.length : end;
      top().text += source.slice(lt + 9, stop);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    // Comment.
    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    // Declaration / processing instruction / doctype.
    if (source.startsWith('<?', lt) || source.startsWith('<!', lt)) {
      const end = source.indexOf('>', lt);
      i = end === -1 ? source.length : end + 1;
      continue;
    }

    const gt = source.indexOf('>', lt);
    if (gt === -1) break;
    const raw = source.slice(lt + 1, gt).trim();

    // Closing tag.
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      // Unwind to the matching open element. A stray close tag is ignored rather
      // than fatal — one malformed node must not cost a tenant their whole site.
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s]!.name === name) {
          stack.length = s;
          break;
        }
      }
      i = gt + 1;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const space = body.search(/\s/);
    const name = space === -1 ? body : body.slice(0, space);
    const node: XmlNode = {
      name,
      attrs: space === -1 ? {} : parseAttrs(body.slice(space)),
      children: [],
      text: '',
    };
    top().children.push(node);
    if (!selfClosing) stack.push(node);
    i = gt + 1;
  }

  // Trim once on the way out. Entities were resolved as plain text was appended and
  // CDATA was appended raw — which is the distinction that matters: CDATA is literal
  // by definition, so decoding it would turn `&amp;` inside a post's HTML body into a
  // bare `&` and quietly corrupt every URL with a query string in the tenant's content.
  const finish = (node: XmlNode): void => {
    node.text = node.text.trim();
    for (const child of node.children) finish(child);
  };
  finish(root);

  return root.children[0] ?? null;
}

/** First direct child with this tag name. */
export function child(node: XmlNode | null | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

/** All direct children with this tag name. */
export function children(node: XmlNode | null | undefined, name: string): XmlNode[] {
  return node?.children.filter((c) => c.name === name) ?? [];
}

/** Text of the first direct child with this tag name, or `''`. */
export function childText(node: XmlNode | null | undefined, name: string): string {
  return child(node, name)?.text ?? '';
}

/**
 * WordPress writes post meta as repeated `<wp:postmeta>` pairs. This reads one by
 * key, which is how `_wp_attached_file`, `_yoast_wpseo_title` and friends are found.
 */
export function metaValue(node: XmlNode, key: string): string {
  for (const meta of children(node, 'wp:postmeta')) {
    if (childText(meta, 'wp:meta_key') === key) return childText(meta, 'wp:meta_value');
  }
  return '';
}
