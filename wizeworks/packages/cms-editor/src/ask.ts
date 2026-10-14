// What the editor's ask bar does with what a person types.
//
// The toolbar used to ask through `window.prompt`: a grey browser box that said
// "Link URL", "Embed URL" and "Code language", could not offer one of the writer's own
// pieces, and accepted anything (persona P09). The bar that replaced it reads the same
// typed text, and these rules decide what it means.

/** One of the writer's own pages, offered as a link target while she types. */
export interface LinkSuggestion {
  label: string;
  href: string;
  /** A second line: the kind of page, so two pieces with one title can be told apart. */
  hint?: string;
}

export type LinkSuggestFn = (query: string) => Promise<LinkSuggestion[]>;

export type ReadHref = { href: string } | { href: null } | { error: string };

const KEPT = /^(https?:\/\/|\/|#|mailto:|tel:)/i;
const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

/**
 * Turn what she typed into a link address. Empty means "take the link off". A bare
 * `example.com/page` gets `https://`, and a bare email address becomes a mail link,
 * because that is what she meant. Anything else is refused with a sentence that says
 * what to type instead.
 */
export function readHref(typed: string): ReadHref {
  const text = typed.trim();
  if (text === '') return { href: null };
  if (KEPT.test(text)) return /\s/.test(text) ? { error: SPACES } : { href: text };
  if (EMAIL.test(text)) return { href: `mailto:${text}` };
  if (DOMAIN.test(text)) return { href: `https://${text}` };
  return { error: NOT_AN_ADDRESS };
}

const SPACES = 'A web address has no spaces in it. Check it and try again.';
const NOT_AN_ADDRESS =
  'That is not a web address. Paste a full address, such as https://example.com.';

/**
 * Whether the text is worth searching her pages for. An address she is pasting is not
 * a title, so it is not searched.
 */
export function searchesPages(typed: string): boolean {
  const text = typed.trim();
  return text.length >= 2 && !KEPT.test(text) && !EMAIL.test(text) && !DOMAIN.test(text);
}
