'use client';

// The storefront's silica behavior runtime (docs/118 Stage 6b). silica renders a
// published page/frame as fully-resolved HTML (SilicaBody / SilicaChrome); the only
// live markers left after `resolveTree` are `data-sui-behavior` (carousel,
// disclosure, tabs, menu, modal, marquee, scrollspy, theme-toggle, …) and
// `data-sui-action` (host actions). `hydrate()` from @wizeworks/silicaui-behaviors
// wires every built-in behavior with zero React; this component is the sparx HOST
// half — it mounts `hydrate` and routes the `onAction` channel to the storefront's
// own providers (cart, newsletter capture).
//
// `hydrate` is idempotent (already-wired roots are skipped), so re-running it after
// a client navigation just wires the newly-rendered markers. It returns a dispose
// fn that tears down every listener/observer it registered.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hydrate, type ActionPayload } from '@wizeworks/silicaui-behaviors';

import { useCart } from './cart-provider';
import { addToCartRequest, firstValue, type FormValue } from '@/lib/add-to-cart-values';
import { AccountError, addToQuoteRequest } from '@/lib/customer-client';
import {
  QUOTE_REQUEST_ACTION,
  QUOTE_REQUEST_BUTTON,
  quoteRequestAddedMessage,
  quoteRequestFromForms,
} from '@/lib/quote-request-tree';
import { subscribeEmail } from '@/lib/signup-client';
import { submitContactForm } from '@/lib/contact-client';
import { pageSlugFromPath } from '@/lib/page-slug';
import { hasUnwiredMarkers, WIRED_ATTR } from '@/lib/silica-markers';

/** A form's fields the way silica's form behavior hands them over: one value,
 *  or several for a repeated name. */
function formValues(form: HTMLFormElement): Record<string, FormValue> {
  const data = new FormData(form);
  const out: Record<string, FormValue> = {};
  for (const key of new Set(data.keys())) {
    const all = data.getAll(key).map((v) => (typeof v === 'string' ? v : v.name));
    out[key] = all.length > 1 ? all : (all[0] ?? '');
  }
  return out;
}

export function SilicaBehaviors({
  tenantSlug,
  propertySlug,
}: {
  tenantSlug: string;
  propertySlug?: string;
}) {
  const { addItem, openDrawer } = useCart();
  // Re-hydrate after each client navigation — new page markers need wiring, and
  // hydrate skips roots it already wired, so this never double-binds.
  const pathname = usePathname();

  useEffect(() => {
    const onAction = async (ref: string | null, payload: ActionPayload) => {
      const values = payload.kind === 'submit' ? payload.values : {};

      // Newsletter / email-capture forms (docs/51 §7): a silica <form> authored
      // with data-sui-action="email-signup" and an `email` field opts the address
      // into marketing through the same public endpoint the legacy block used.
      if (ref === 'email-signup' || ref === 'newsletter' || ref === 'signup') {
        const email = firstValue(values.email);
        // The authored node's id, read off the element the behavior handed us —
        // the same way the contact branch below does it. It is what enters the
        // address into whichever campaign points at this block (docs/152 C1);
        // absent, the signup still works and simply joins no campaign.
        const nodeId =
          payload.kind === 'submit'
            ? (payload.form.getAttribute('data-sui-id') ?? undefined)
            : undefined;
        if (email) await subscribeEmail(tenantSlug, email, propertySlug, nodeId);
        return;
      }

      // Contact / lead forms (docs/115): silica's `contactSection` block lowers to a
      // real <form> carrying the `form` behavior and this action ref. silicaui does
      // the whole client half — validation, FormData, busy/success/error states — and
      // deliberately stops at the host seam; THIS is the seam. Without it the block
      // renders, validates, and silently posts nowhere.
      //
      // We must tell the server WHICH form submitted, because that is what it checks
      // against the published tree (anti-forgery) and what keys the routing row. The
      // <form> element carries the authored node's id as `data-sui-id` (emitted by
      // SilicaChrome's metaProps), so we read it off the element the behavior handed
      // us rather than trusting anything in the payload values.
      if (ref === 'contact' && payload.kind === 'submit') {
        const nodeId = payload.form.getAttribute('data-sui-id');
        if (!nodeId) return;
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(values)) {
          const one = firstValue(v);
          if (one !== undefined) flat[k] = one;
        }
        // Throwing is the contract: the form behavior awaits this promise and settles
        // the form's `data-sui-state` to success or error from it, so a failed submit
        // shows the visitor an error instead of a false thank-you.
        await submitContactForm(tenantSlug, propertySlug, pageSlugFromPath(pathname), {
          nodeId,
          values: flat,
          ...(flat.honeypot !== undefined ? { honeypot: flat.honeypot } : {}),
        });
        // Sent, so the boxes empty. The thank-you sat over a still-filled form with
        // an enabled Send, and a second press put the same message in the owner's
        // inbox twice (sparx persona issue 048). Emptied, the required fields stop
        // a repeat until the visitor writes a new message. Here and not in the
        // silica `form` behavior, which also runs add-to-cart: a buy box keeps its
        // choices after a successful add.
        payload.form.reset();
        return;
      }

      // "Add to quote request" on a product page (sparx persona issue 086): a
      // second silica form placed straight after the buy box by
      // `lib/quote-request-tree`. Its own fields name the account; the version
      // and quantity are the ones chosen in the buy box beside it. Throwing
      // settles the form to its error state with the reason in its status line.
      if (ref === QUOTE_REQUEST_ACTION && payload.kind === 'submit') {
        const buyForm = payload.form.parentElement?.querySelector<HTMLFormElement>(
          'form[data-sui-action="add-to-cart"]'
        );
        const asked = quoteRequestFromForms(values, buyForm ? formValues(buyForm) : null);
        if (!asked) {
          payload.form.setAttribute('data-error-message', 'Choose a version first.');
          throw new Error('quote request: no version chosen');
        }
        try {
          const request = await addToQuoteRequest(
            tenantSlug,
            asked.accountId,
            asked.variantId,
            asked.quantity
          );
          payload.form.setAttribute(
            'data-success-message',
            quoteRequestAddedMessage(request.lines.length)
          );
        } catch (err) {
          payload.form.setAttribute(
            'data-error-message',
            err instanceof AccountError && err.status < 500
              ? err.message
              : 'It was not added to your quote request. Please try again.'
          );
          throw err;
        }
        return;
      }

      // Add-to-cart / buy-now: the buy box is a silica <form> whose hidden
      // `variantId` field is bound to the product's default variant, plus a
      // `quantity` number field (@wizeworks/silica-catalog `buyBox`).
      //
      // The empty-variant guard is load-bearing, not defensive noise: a product
      // with no live variant resolves `variantId` to '', and `required` is INERT
      // on a hidden input — so `form.checkValidity()` passes and the submit
      // dispatches anyway. This is the only thing standing between that and a
      // cart line for a variant that doesn't exist.
      if (ref === 'add-to-cart' || ref === 'buy-now') {
        // The fields the buy box posts, as the cart call they ask for: the
        // variant (null when there is none, which blocks the add), the quantity,
        // the schedule (issue 739) and the old-part choice (issue 057).
        const request = addToCartRequest(values);
        if (!request) return;
        const { variantId, quantity, repeat, coreFirst } = request;
        try {
          await addItem(variantId, quantity, repeat, coreFirst);
        } catch (err) {
          // silica's form behavior settles to its error state and announces
          // `data-error-message` (falling back to a generic "Something went
          // wrong. Please try again."). Point that at the CartError's real,
          // shopper-friendly reason first — "Sorry, this item just sold out."
          // for a 409 — so a permanent sell-out doesn't read as a transient
          // "try again" (BUG-001 follow-up). Then re-throw so the form still
          // shows its error state and the drawer stays shut.
          if (payload.kind === 'submit' && err instanceof Error && err.message) {
            payload.form.setAttribute('data-error-message', err.message);
          }
          throw err;
        }
        openDrawer();
      }
    };
    const dispose = hydrate(document, { onAction });
    // Markers that arrive after this pass (a server re-render at the same
    // address, such as the refresh after signing in) were never wired, so a
    // silica form among them did a bare browser submit: "Add to quote request"
    // reloaded the product page as `?accountId=…` (sparx persona issue 086).
    // Wiring is idempotent, so new markers are wired as they appear.
    const later: (() => void)[] = [];
    let queued = false;
    const observer = new MutationObserver((records) => {
      if (queued || !hasUnwiredMarkers(records)) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        later.push(hydrate(document, { onAction }));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // "Add to quote request" has a plain button, not a submit button, so the
    // browser can never submit its form on its own (see lib/quote-request-tree).
    // A press submits it through the wired form behavior, wiring it first if
    // it somehow is not yet, and never through a bare browser submit.
    const onQuoteRequestPress = (ev: MouseEvent) => {
      const target = ev.target instanceof Element ? ev.target : null;
      const button = target?.closest(`[${QUOTE_REQUEST_BUTTON}]`);
      const form = button?.closest('form');
      if (!form) return;
      ev.preventDefault();
      if (!form.hasAttribute(WIRED_ATTR)) later.push(hydrate(document, { onAction }));
      if (form.hasAttribute(WIRED_ATTR)) form.requestSubmit();
    };
    document.addEventListener('click', onQuoteRequestPress);

    return () => {
      document.removeEventListener('click', onQuoteRequestPress);
      observer.disconnect();
      for (const undo of later.splice(0)) undo();
      dispose();
    };
  }, [pathname, tenantSlug, propertySlug, addItem, openDrawer]);

  return null;
}
