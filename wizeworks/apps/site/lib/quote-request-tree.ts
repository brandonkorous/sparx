// "Add to quote request" on the LIVE product page (sparx persona issue 086).
//
// The /b2b page promised "From the catalog, the buyer builds a request
// (quantities, delivery needs, notes) and submits it." The product page a
// tenant's customers see is the published silica template; the React
// `components/product-detail.tsx` serves only the sample-data preview. So the
// button lives here, added to the tree for the one request it is rendered for,
// the same way `buying-rules-tree.ts` and `fleet-fit-tree.ts` adjust it: nothing
// to republish, every product page already live picks it up.
//
// It is a second silica action form, placed straight after the add-to-cart
// form, carrying `data-sui-action="quote-request"`. The storefront's behavior
// runtime (`components/silica-behaviors.tsx`) handles that action the way it
// handles add-to-cart, reading the version and quantity chosen in the buy box
// beside it and adding them to the account's open request on the server.
//
// Only for a signed-in trade contact whose role can order (the primary contact
// or a buyer). A visitor, a viewer and an approver get the template exactly as
// published. A signed-in read is never cached, so the account id written in is
// this buyer's.

import { action, behave, el, type Node } from '@wizeworks/silicaui-html';

import { addToCartRequest, firstValue, type FormValue } from './add-to-cart-values';
import type { AccountOrdering } from './account-buying-rules';

/** The action ref the storefront runtime answers with "add to quote request". */
export const QUOTE_REQUEST_ACTION = 'quote-request';

/** The attribute on its button, which the runtime listens for. */
export const QUOTE_REQUEST_BUTTON = 'data-quote-request-submit';

interface TreeNode {
  kind?: string;
  tag?: string;
  children?: (TreeNode | string)[];
  data?: { kind?: string; ref?: string };
}

function isActionForm(node: TreeNode | string, ref: string): boolean {
  return (
    typeof node !== 'string' &&
    node.kind === 'element' &&
    node.tag === 'form' &&
    node.data?.kind === 'action' &&
    node.data.ref === ref
  );
}

function hasActionForm(node: TreeNode, ref: string): boolean {
  if (isActionForm(node, ref)) return true;
  return (node.children ?? []).some((c) => typeof c !== 'string' && hasActionForm(c, ref));
}

/** The form itself. Its status line shows the confirmation the runtime writes
 *  into `data-success-message`, or the reason it was refused. */
export function quoteRequestForm(accountId: string, accountName: string): Node {
  return action(
    behave(
      el('form', 'mt-4 flex flex-col gap-2 border-t border-base-300 pt-4', {
        attrs: { 'data-success-message': '' },
        children: [
          el('p', 'text-base text-base-content', {
            text: `Buying in quantity? Add this to ${accountName}’s quote request and ask for a price.`,
          }),
          el('input', '', { attrs: { type: 'hidden', name: 'accountId', value: accountId } }),
          el('div', 'flex flex-wrap items-center gap-3', {
            children: [
              // NOT a submit button. A browser submit of this form, which
              // happens whenever the runtime has not wired it, posts to the page
              // it is on: on screen that reloaded the product page as
              // `?accountId=…` with the site and the quantity gone. silica
              // allows no form `action` to point anywhere better, so the button
              // does nothing by itself and the storefront runtime submits the
              // form through its wired behavior (`components/silica-behaviors`).
              el('button', 'btn btn-primary btn-outline', {
                text: 'Add to quote request',
                attrs: {
                  type: 'button',
                  [QUOTE_REQUEST_BUTTON]: '',
                  // The form behavior disables its submit part while it works.
                  'data-sui-part': 'submit',
                },
              }),
              el('a', 'link link-primary', {
                text: 'See your quote request',
                attrs: { href: `/account/b2b/${accountId}/quotes` },
              }),
            ],
          }),
          el('p', 'text-base text-base-content empty:hidden', {
            attrs: { 'data-sui-part': 'status', 'aria-live': 'polite' },
          }),
        ],
      }),
      { type: 'form' }
    ),
    QUOTE_REQUEST_ACTION
  );
}

function insertAfterBuyForm(node: TreeNode, form: Node): TreeNode {
  if (!node.children) return node;
  const out: (TreeNode | string)[] = [];
  for (const child of node.children) {
    if (typeof child === 'string') {
      out.push(child);
      continue;
    }
    if (isActionForm(child, 'add-to-cart')) {
      out.push(child, form);
      continue;
    }
    out.push(insertAfterBuyForm(child, form));
  }
  return { ...node, children: out };
}

/**
 * The template with "Add to quote request" after every add-to-cart form, for a
 * contact who can order on a trade account. Returns the SAME object for
 * everyone else, and for a template that has no add-to-cart form or already
 * carries the quote request form.
 */
export function withQuoteRequest<
  T extends { root: unknown; symbols?: Record<string, { root: unknown }> },
>(template: T, product: { accountOrdering?: AccountOrdering | null }): T {
  const ordering = product.accountOrdering ?? null;
  if (!ordering?.canOrder || !ordering.accountId) return template;
  const roots = [
    template.root as TreeNode,
    ...Object.values(template.symbols ?? {}).map((s) => s.root as TreeNode),
  ];
  if (!roots.some((r) => hasActionForm(r, 'add-to-cart'))) return template;
  if (roots.some((r) => hasActionForm(r, QUOTE_REQUEST_ACTION))) return template;

  const form = quoteRequestForm(ordering.accountId, ordering.accountName);
  const symbols = template.symbols
    ? Object.fromEntries(
        Object.entries(template.symbols).map(([key, def]) => [
          key,
          { ...def, root: insertAfterBuyForm(def.root as TreeNode, form) },
        ])
      )
    : undefined;
  return {
    ...template,
    root: insertAfterBuyForm(template.root as TreeNode, form),
    ...(symbols ? { symbols } : {}),
  };
}

/**
 * What a click on "Add to quote request" asks for: the account (from its own
 * form) and the version and quantity chosen in the buy box beside it (that
 * form's fields, read through the same `addToCartRequest` add-to-cart uses).
 * Null when either is missing.
 */
export function quoteRequestFromForms(
  own: Record<string, FormValue>,
  buyBox: Record<string, FormValue> | null
): { accountId: string; variantId: string; quantity: number } | null {
  const accountId = firstValue(own.accountId);
  if (!accountId || !buyBox) return null;
  const chosen = addToCartRequest(buyBox);
  if (!chosen) return null;
  return { accountId, variantId: chosen.variantId, quantity: chosen.quantity };
}

/** The confirmation, in the same words the account pages use. */
export function quoteRequestAddedMessage(itemCount: number): string {
  return `Added. Your request has ${itemCount === 1 ? '1 item' : `${itemCount} items`} and has not been sent yet.`;
}
