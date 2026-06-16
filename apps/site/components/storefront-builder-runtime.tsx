'use client';

// Bridges the shared Builder render runtime (docs/builder/02 §2.3) to the live
// storefront's cart + capture stack. The interactive islands the renderer ships
// (BuyBox/AddToCart, the signup form) read their terminal effects from
// `useBuilderRuntime()`; this provider, mounted once inside the storefront's
// <CartProvider>/<CustomerProvider>, wires those effects to the real APIs. The
// editor canvas mounts no such provider, so the SAME islands run inert there.
//
// Kept in apps/site (not the shared package) so the cart/customer providers — and
// their many account-page consumers — stay put; only this thin adapter knows both
// sides.

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { BuilderRuntimeProvider, type BuilderRuntime } from '@sparx/builder-render';

import { useCart } from './cart-provider';
import { useCustomer } from './customer-provider';
import { subscribeEmail } from '@/lib/signup-client';

export function StorefrontBuilderRuntime({ children }: { children: React.ReactNode }) {
  const { addItem } = useCart();
  const { tenantSlug, propertySlug } = useCustomer();
  const router = useRouter();
  const runtime = React.useMemo<BuilderRuntime>(
    () => ({
      addToCart: (variantId, quantity) => addItem(variantId, quantity),
      // Buy now (docs/98 Pillar 7): add the variant, then skip the drawer and send
      // the buyer straight to checkout.
      buyNow: async (variantId, quantity) => {
        await addItem(variantId, quantity);
        router.push('/checkout');
      },
      subscribeEmail: (email) => subscribeEmail(tenantSlug, email, propertySlug),
    }),
    [addItem, router, tenantSlug, propertySlug]
  );
  return <BuilderRuntimeProvider runtime={runtime}>{children}</BuilderRuntimeProvider>;
}
