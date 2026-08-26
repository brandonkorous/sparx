'use client';

// Bridges the shared Builder render runtime (docs/builder/02 §2.3) to the live
// storefront's cart + capture stack. The interactive islands the renderer ships
// (BuyBox/AddToCart, the signup form) read their terminal effects from
// `useBuilderRuntime()`; this provider, mounted once inside the storefront's
// <CartProvider>/<CustomerProvider>, wires those effects to the real APIs. The
// editor canvas mounts no such provider, so the SAME islands run inert there.
//
// Kept in wizeworks/apps/site (not the shared package) so the cart/customer providers — and
// their many account-page consumers — stay put; only this thin adapter knows both
// sides.

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';

import {
  BuilderBehaviors,
  BuilderRuntimeProvider,
  type BuilderRuntime,
} from '@wizeworks/builder-render';

import { useCart } from './cart-provider';
import { useCustomer } from './customer-provider';
import type { Customer } from '@/lib/customer-client';
import { subscribeEmail } from '@/lib/signup-client';
import { capturePartialForm, submitContactForm } from '@/lib/contact-client';
import { pageSlugFromPath } from '@/lib/page-slug';

/** Display name for the account menu: full name, else the email, else null. */
function accountName(c: Customer | null): string | null {
  if (!c) return null;
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return full !== '' ? full : (c.email ?? null);
}

export function SiteBuilderRuntime({ children }: { children: React.ReactNode }) {
  const { addItem } = useCart();
  const { tenantSlug, propertySlug, customer, status, logout } = useCustomer();
  const router = useRouter();
  const pathname = usePathname();
  const runtime = React.useMemo<BuilderRuntime>(
    () => ({
      addToCart: (variantId, quantity) => addItem(variantId, quantity),
      // Buy now (docs/98 Pillar 7): add the variant, then skip the drawer and send
      // the buyer straight to checkout.
      buyNow: async (variantId, quantity) => {
        await addItem(variantId, quantity);
        router.push('/checkout');
      },
      subscribeEmail: (email, nodeId) => subscribeEmail(tenantSlug, email, propertySlug, nodeId),
      // Contact form (docs/115): the island passes node id + values; the bridge
      // adds the trusted tenant/site slugs + the current page slug so the server
      // can resolve the form's routing config. The form never composes routing.
      submitForm: (input) =>
        submitContactForm(tenantSlug, propertySlug, pageSlugFromPath(pathname), input),
      // A form somebody started and has not finished (docs/152 C2) — same trusted
      // slugs, same page locator, and the same rule that the form never composes
      // its own routing.
      captureFormPartial: (input) =>
        capturePartialForm(tenantSlug, propertySlug, pageSlugFromPath(pathname), input),
      // The customer session for the AccountMenu island (docs/27) — signed-in name,
      // status, and a sign-out that clears the session then re-renders.
      account: {
        status,
        name: accountName(customer),
        signOut: async () => {
          await logout();
          router.refresh();
        },
      },
    }),
    [addItem, router, pathname, tenantSlug, propertySlug, customer, status, logout]
  );
  // Hydrate the sanctioned behavior runtime (docs/98 Pillar 5) over the live tree —
  // full behavior here (autoplay, scroll listeners, marquee cloning), unlike the
  // canvas's suppressed preview mode.
  return (
    <BuilderRuntimeProvider runtime={runtime}>
      <BuilderBehaviors>{children}</BuilderBehaviors>
    </BuilderRuntimeProvider>
  );
}
