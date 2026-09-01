// Silica element attributes → React props, for the frame/page walk in
// `silica-chrome.tsx`.
//
// A silica node carries REAL HTML attribute names, because that is what `toHtml`
// has to emit for the compiled storefront. React wants its own spelling for some
// of them and warns on the rest ("Invalid DOM property `autoplay`. Did you mean
// `autoPlay`?"), so the React walk translates on the way in.
//
// Its own file because it is its own job, and because `silica-chrome.tsx` is a
// server component: the walk cannot be exercised without React and a DOM, and
// this table can be exercised with neither.

import { sanitizeElement } from '@wizeworks/silicaui-html';

// Names whose React spelling is NOT derivable from the HTML one.
//
// Keep in step with silica's `sanitizeElement` allow-set — that whitelist is the
// universe of names reaching here, so an attribute added there that React spells
// differently logs a console error on every affected node until it is listed.
const ATTR_REMAP: Record<string, string> = {
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  minlength: 'minLength',
  for: 'htmlFor',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  readonly: 'readOnly',
  novalidate: 'noValidate',
  contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin',
  srcset: 'srcSet',
  inputmode: 'inputMode',
  enctype: 'encType',
  spellcheck: 'spellCheck',
  // media — a `<video>`/`<audio>` in the frame (a muted looping hero background)
  autoplay: 'autoPlay',
  playsinline: 'playsInline',
  // `<time datetime>`
  datetime: 'dateTime',
};

// HTML and React spell these the same and mean DIFFERENT THINGS, which is why
// `ATTR_REMAP` could never catch them: it fixes names React spells differently,
// and the danger here is the two names being identical.
//
// In HTML, `value` and `checked` are a control's INITIAL state and the person
// using the page owns it from then on. In React they are the CONTROLLED state,
// owned by a component — and a controlled field with no `onChange` is frozen.
// React says so ("This will render a read-only field") and then renders a box
// nobody can type in.
//
// A tenant's product page shipped with `<input name="quantity" value="1">` in its
// buy box. Walked to React it became a controlled `1`: typing did nothing, the
// spinner arrows did nothing, the up-arrow key did nothing, and no customer could
// buy two of anything (issue 371). The older `safeElementAttrs` renderer already
// knew — it maps `value` to `defaultValue`, with a comment saying why, and a test
// covering it — and this walk did not inherit any of it.
const UNCONTROLLED: Record<string, string> = {
  value: 'defaultValue',
  checked: 'defaultChecked',
};

const FORM_CONTROLS = new Set(['input', 'textarea', 'select']);

/** React's uncontrolled spelling for an initial-state attribute, or undefined when
 *  the attribute is not one.
 *
 *  A radio or checkbox keeps its `value`: there it is the payload the form submits
 *  rather than the state of the control, so React neither freezes it nor complains.
 *  Its `checked` is the state, and does get remapped. */
export function uncontrolledProp(
  tag: string,
  name: string,
  attrs: Record<string, string | number | boolean> | undefined
): string | undefined {
  if (!FORM_CONTROLS.has(tag)) return undefined;
  const toggle = tag === 'input' && (attrs?.type === 'checkbox' || attrs?.type === 'radio');
  if (name === 'value' && toggle) return undefined;
  return UNCONTROLLED[name];
}

// The two hyphenated namespaces React passes through verbatim; everything else
// hyphenated is an SVG presentation attribute it wants camelCased.
const VERBATIM_ATTR_PREFIX = /^(?:data|aria)-/;

/** The React prop name for one sanitized attribute. Every hyphenated SVG attribute
 *  React knows (`stroke-width`, `clip-path`, `stop-color`, `dominant-baseline`, …)
 *  is its HTML name kebab→camel with no exceptions, so deriving those closes the
 *  whole class — a pasted brand logo keeps its strokes and gradients instead of
 *  filling the console. */
export function reactAttrName(name: string): string {
  const remapped = ATTR_REMAP[name];
  if (remapped) return remapped;
  if (!name.includes('-') || VERBATIM_ATTR_PREFIX.test(name)) return name;
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Sanitized element attrs → React props (with the camelCase and uncontrolled
 *  remaps). Sanitizing here rather than in the caller keeps the security gate and
 *  the translation in one place: nothing reaches React that silica did not allow. */
export function attrProps(
  tag: string,
  attrs: Record<string, string | number | boolean> | undefined
): Record<string, unknown> {
  const { attrs: safe } = sanitizeElement(tag, attrs);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(safe ?? {})) {
    out[uncontrolledProp(tag, k, safe) ?? reactAttrName(k)] = v;
  }
  return out;
}
