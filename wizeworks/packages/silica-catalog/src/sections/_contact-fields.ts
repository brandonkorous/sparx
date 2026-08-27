// The three facts a business types once — address, phone, email — as nodes that
// follow Site identity instead of freezing whatever the shelf block was authored
// with.
//
// The gap this closes: the palette's "Find us" and "Contact strip" shipped a real
// -looking phone number and street, so a business that placed one and did not notice
// published somebody else's details. The starter sites bound the same three fields
// and told the author so on the canvas; only the blocks they could ADD did not.
//
// A node carries ONE `data` binding, so each field is two nodes: an outer that
// decides whether it renders at all, and an inner that carries the value.

import { bind, el, type ElementNode, type Node } from '@wizeworks/silicaui-html';
import { bindAttr } from '../attr-binding';
import { visibleWhen } from '../conditional';

/** Where the details come from — the per-site contact block a business types once. */
export const CONTACT_REF = {
  phone: 'site.identity.phone',
  phoneHref: 'site.identity.phoneHref',
  email: 'site.identity.email',
  emailHref: 'site.identity.emailHref',
  address: 'site.identity.address',
} as const;

/** Render `inner` only when `ref` has a value, with no wrapper of its own. */
function whenSet(ref: string, inner: Node): Node {
  return visibleWhen(el('div', 'contents', { children: [inner] }), ref);
}

/**
 * The business's address as one `<address>`.
 *
 * One node, not one per line: a binding fills a node's whole content, so the lines
 * arrive as a single string and `whitespace-pre-line` keeps the breaks the owner typed.
 */
export function boundAddress(cls: string, sample: string): Node {
  return whenSet(
    CONTACT_REF.address,
    bind(
      el('address', `whitespace-pre-line not-italic ${cls}`, { text: sample }),
      CONTACT_REF.address
    )
  );
}

/** The phone or email as a pressable link — its words and its `href` both bound. */
export function boundContactLink(kind: 'phone' | 'email', cls: string, sample: string): Node {
  const valueRef = kind === 'phone' ? CONTACT_REF.phone : CONTACT_REF.email;
  const hrefRef = kind === 'phone' ? CONTACT_REF.phoneHref : CONTACT_REF.emailHref;
  const anchor: ElementNode = el('a', cls, {
    children: [bind(el('span', '', { text: sample }), valueRef)],
  });
  return whenSet(valueRef, bindAttr(anchor, 'href', hrefRef));
}

/**
 * A call to action whose WORDS are the author's and whose destination is the
 * business's.
 *
 * `boundContactLink` prints the address as its own label, which is right in a
 * footer and wrong on a button — "Email us" has to go on saying "Email us". The
 * button goes when the field is unset, because a contact page that offers a
 * button going nowhere is worse than one that offers none.
 */
export function boundContactAction(kind: 'phone' | 'email', cls: string, label: string): Node {
  const valueRef = kind === 'phone' ? CONTACT_REF.phone : CONTACT_REF.email;
  const hrefRef = kind === 'phone' ? CONTACT_REF.phoneHref : CONTACT_REF.emailHref;
  return whenSet(valueRef, bindAttr(el('a', cls, { text: label }), 'href', hrefRef));
}

/**
 * A sentence with the business's phone number inside it.
 *
 * The number is a node of its own so it can be bound, and the words either side
 * stay the author's. The whole line goes when there is no phone: half a sentence
 * reads worse than none.
 */
export function boundPhoneLine(cls: string, before: string, after: string, sample: string): Node {
  return whenSet(
    CONTACT_REF.phone,
    el('p', cls, {
      children: [
        el('span', '', { text: before }),
        bind(el('span', '', { text: sample }), CONTACT_REF.phone),
        el('span', '', { text: after }),
      ],
    })
  );
}
