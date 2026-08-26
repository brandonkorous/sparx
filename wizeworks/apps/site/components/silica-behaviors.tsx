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
import { subscribeEmail } from '@/lib/signup-client';
import { submitContactForm } from '@/lib/contact-client';
import { pageSlugFromPath } from '@/lib/page-slug';

/** First value of a form field (a repeated name gathers to an array). */
function firstValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
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
    const dispose = hydrate(document, {
      onAction: async (ref: string | null, payload: ActionPayload) => {
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
          const variantId = firstValue(values.variantId);
          if (!variantId) return;
          const quantity = Number(firstValue(values.quantity) ?? '1') || 1;
          try {
            await addItem(variantId, quantity);
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
      },
    });
    return dispose;
  }, [pathname, tenantSlug, propertySlug, addItem, openDrawer]);

  return null;
}
