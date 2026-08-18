// TipTap document kit for authoring sample article bodies.
//
// A `rich_text` content field stores a TipTap/ProseMirror doc
// (`{ type: 'doc', content: [...] }`, validated by @wizeworks/cms-schemas). These
// helpers keep pack articles readable — `doc(h2('…'), p('…'), ul('a','b'))` —
// instead of hand-writing node JSON. Only StarterKit node types are emitted
// (paragraph, heading, bullet/ordered list, blockquote, text + hardBreak), which
// every sparx prose renderer + @wizeworks/cms-editor serializer understands.

interface ProseNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseNode[];
  text?: string;
  marks?: { type: string }[];
}

/** A bold inline run (use inside `p([...])`). */
export function b(text: string): ProseNode {
  return { type: 'text', text, marks: [{ type: 'bold' }] };
}

function inline(value: string | ProseNode): ProseNode {
  return typeof value === 'string' ? { type: 'text', text: value } : value;
}

/** A paragraph. Pass a string, or an array mixing strings and inline runs. */
export function p(value: string | (string | ProseNode)[]): ProseNode {
  const content = (Array.isArray(value) ? value : [value]).map(inline);
  return { type: 'paragraph', content };
}

function heading(level: number, text: string): ProseNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

export const h2 = (text: string): ProseNode => heading(2, text);
export const h3 = (text: string): ProseNode => heading(3, text);

function listItem(text: string): ProseNode {
  return { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

/** A bullet list from item strings. */
export function ul(...items: string[]): ProseNode {
  return { type: 'bulletList', content: items.map(listItem) };
}

/** An ordered list from item strings. */
export function ol(...items: string[]): ProseNode {
  return { type: 'orderedList', content: items.map(listItem) };
}

/** A block quote (single paragraph). */
export function quote(text: string): ProseNode {
  return {
    type: 'blockquote',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

/** Assemble a document from block nodes. */
export function doc(...blocks: ProseNode[]): ProseNode {
  return { type: 'doc', content: blocks };
}
