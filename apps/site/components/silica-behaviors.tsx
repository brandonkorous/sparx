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
          if (email) await subscribeEmail(tenantSlug, email, propertySlug);
          return;
        }

        // Add-to-cart / buy-now: the buy box is a silica <form> whose hidden
        // `variantId` field is bound to the product's default variant, plus a
        // `quantity` number field (@sparx/silica-catalog `buyBox`).
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
          await addItem(variantId, quantity);
          openDrawer();
        }
      },
    });
    return dispose;
  }, [pathname, tenantSlug, propertySlug, addItem, openDrawer]);

  return null;
}
