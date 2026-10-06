// "Add to quote request" on the LIVE product page (sparx persona issue 086).
//
// The product page a tenant's customers actually see is the published silica
// template, never `components/product-detail.tsx` (that one serves only the
// sample-data preview). The button was put only in the React component, so a
// trade buyer on a real product page had no way to add to a quote request.
//
// These run the REAL stamped product page (`productDetailPage()`) through the
// REAL silica resolver the storefront uses, with a real product record, so a
// change to the stamped markup cannot quietly take the form off the page.

import { describe, expect, it } from 'vitest';
import { createSilicaResolver } from '@wizeworks/builder-schemas';
import { productDetailPage } from '@wizeworks/silica-catalog';
import { resolveTree, toHtml } from '@wizeworks/silicaui-html';

import { applyAccountBuying } from './buying-rules-tree';
import type { PublicProduct } from './commerce';
import {
  QUOTE_REQUEST_ACTION,
  QUOTE_REQUEST_BUTTON,
  quoteRequestAddedMessage,
  quoteRequestFromForms,
  withQuoteRequest,
} from './quote-request-tree';
import { SAMPLE_PRODUCT } from './sample-data';
import { productToSilicaRecord } from './silica-data';

const WASATCH = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';

const buyer = {
  accountId: WASATCH,
  accountName: 'Wasatch Front Utility Contractors',
  canOrder: true,
  refusal: null,
};

function product(over: Partial<PublicProduct> = {}): PublicProduct {
  return { ...SAMPLE_PRODUCT, ...over };
}

/** The product page exactly as the live route renders it: the fleet and
 *  buying-rule rewrites, then this one, then the real resolver. */
function render(p: PublicProduct): string {
  const page = withQuoteRequest(applyAccountBuying({ root: productDetailPage() }, p), p);
  const resolver = createSilicaResolver({
    root: { product: productToSilicaRecord(p, 'gillett') },
  });
  return toHtml(resolveTree(page.root, resolver));
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('Add to quote request on the stamped product page', () => {
  it('is there for a trade contact who can order, once, right after the add-to-cart form', () => {
    const html = render(product({ accountOrdering: buyer }));
    expect(count(html, `data-sui-action="${QUOTE_REQUEST_ACTION}"`)).toBe(1);
    expect(html).toContain('Add to quote request');
    expect(html).toContain('Wasatch Front Utility Contractors');
    const cart = html.indexOf('data-sui-action="add-to-cart"');
    const quote = html.indexOf(`data-sui-action="${QUOTE_REQUEST_ACTION}"`);
    expect(cart).toBeGreaterThan(-1);
    expect(quote).toBeGreaterThan(cart);
  });

  it('carries the account it is for, and a way to the request', () => {
    const html = render(product({ accountOrdering: buyer }));
    expect(html).toContain(`name="accountId" value="${WASATCH}"`);
    expect(html).toContain(`/account/b2b/${WASATCH}/quotes`);
  });

  it('cannot be submitted by the browser itself, which would reload this page', () => {
    // On screen, an unwired form posted to the page it was on: the product page
    // reloaded as `?accountId=…`, dropping the site and the chosen quantity.
    const html = render(product({ accountOrdering: buyer }));
    const start = html.indexOf(`data-sui-action="${QUOTE_REQUEST_ACTION}"`);
    const form = html.slice(html.lastIndexOf('<form', start), html.indexOf('</form>', start));
    expect(form).toContain(`${QUOTE_REQUEST_BUTTON}=""`);
    expect(form).toMatch(/<button[^>]*type="button"/);
    expect(form).not.toMatch(/type="submit"/);
    expect(form).not.toMatch(/<button(?![^>]*type=)/);
    // No box to press Enter in, so nothing else can submit it either.
    expect(form).not.toMatch(/<input(?![^>]*type="hidden")/);
  });

  it('is a live silica form, so the storefront runtime wires its submit', () => {
    const html = render(product({ accountOrdering: buyer }));
    const start = html.indexOf(`data-sui-action="${QUOTE_REQUEST_ACTION}"`);
    const tagStart = html.lastIndexOf('<form', start);
    const tag = html.slice(tagStart, html.indexOf('>', start) + 1);
    expect(tag).toContain('data-sui-behavior="form"');
  });

  it('shows nothing new to a visitor, or to a contact who cannot order', () => {
    expect(render(product({ accountOrdering: null }))).not.toContain('quote request');
    const viewer = render(
      product({
        accountOrdering: {
          accountId: WASATCH,
          accountName: 'Wasatch Front Utility Contractors',
          canOrder: false,
          refusal: 'Your role on Wasatch can see orders but not place them.',
        },
      })
    );
    expect(viewer).not.toContain('quote request');
  });

  it('adds nothing for a contact who cannot order, even on a buy box still standing', () => {
    // Belt and braces: the buying rules take the add-to-cart form away from such a
    // contact, and this must not depend on that having run first.
    const page = { root: productDetailPage() };
    const approver = product({
      accountOrdering: { ...buyer, canOrder: false, refusal: 'Ask Renée to place orders.' },
    });
    expect(withQuoteRequest(page, approver)).toBe(page);
  });

  it('leaves the template untouched when there is nothing to add', () => {
    const page = { root: productDetailPage() };
    expect(withQuoteRequest(page, product({ accountOrdering: null }))).toBe(page);
  });
});

describe('what a click on it asks for', () => {
  it('takes the version and quantity chosen in the buy box beside it', () => {
    expect(
      quoteRequestFromForms(
        { accountId: WASATCH },
        { variantId: 'v-2', quantity: '24', repeat: '' }
      )
    ).toEqual({ accountId: WASATCH, variantId: 'v-2', quantity: 24 });
  });

  it('asks for nothing without an account or a version', () => {
    expect(quoteRequestFromForms({}, { variantId: 'v-2', quantity: '1' })).toBeNull();
    expect(
      quoteRequestFromForms({ accountId: WASATCH }, { variantId: '', quantity: '1' })
    ).toBeNull();
    expect(quoteRequestFromForms({ accountId: WASATCH }, null)).toBeNull();
  });

  it('confirms in the same words as everywhere else', () => {
    expect(quoteRequestAddedMessage(1)).toBe(
      'Added. Your request has 1 item and has not been sent yet.'
    );
    expect(quoteRequestAddedMessage(3)).toBe(
      'Added. Your request has 3 items and has not been sent yet.'
    );
  });
});
