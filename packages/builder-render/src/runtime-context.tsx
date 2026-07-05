'use client';

// The Builder render RUNTIME boundary (docs/builder/02 §2.3).
//
// One render path serves two surfaces — the live storefront and the editor
// canvas — that differ only in their terminal SIDE EFFECTS. A live `AddToCart`
// must hit the cart API; the same component in the canvas must NOT (it's a
// preview). Rather than fork the component (the divergence this phase removes),
// the interactive islands read their effects from this injected runtime:
//
//   · LIVE (apps/site): a <BuilderRuntimeProvider> high in the storefront tree
//     bridges these calls to the real <CartProvider>/<CustomerProvider> hooks,
//     which stay in apps/site. See apps/site/components/storefront-builder-runtime.
//   · EDIT (apps/dashboard canvas): no provider → the no-op default runs, so the
//     real BuyBox/Signup render and behave (variant selection, qty, validation)
//     yet never mutate a cart or capture a contact.
//
// The capture-phase interaction shield on the canvas root only `preventDefault`s
// (stops link navigation / form submission); it does NOT stop a React onClick, so
// a click-shield alone can't neutralize an `addToCart()` handler — hence this
// explicit runtime + the EditModeContext below for effects a click can't reach
// (a carousel autoplay timer).

import * as React from 'react';

/** The live customer session the AccountMenu island reads (docs/27). Supplied only
 *  by the live storefront (bridged from apps/site's CustomerProvider); left
 *  undefined on the editor canvas, where the island falls back to a signed-out
 *  preview. */
export interface BuilderAccount {
  status: 'loading' | 'authenticated' | 'anonymous';
  /** Display name (first + last, or the email) — null when signed out. */
  name: string | null;
  /** Sign the customer out (clears the session, then refreshes the UI). */
  signOut: () => Promise<void>;
}

/** A contact/lead form submission from a ContactForm island. Carries only what
 *  the ISLAND knows — the stable form node id, the field values, and the honeypot.
 *  The live bridge (apps/site) adds the trusted scoping (tenant/site slug + the
 *  current page locator) so the server can resolve the form's routing config; the
 *  island never composes routing. */
export interface BuilderFormSubmit {
  nodeId: string;
  values: Record<string, string>;
  /** Hidden anti-bot field — empty for a human; a value ⇒ silently dropped. */
  honeypot?: string;
  /** Files the visitor attached (docs/115 Part D) — the raw File objects from the
   *  form's file inputs. The live bridge uploads each (proxied, magic-sniffed
   *  server-side) and passes the signed tokens to the submit endpoint; the canvas
   *  no-ops. Empty/omitted for a form with no file field. */
  files?: File[];
}

/** The terminal side effects the interactive islands perform. Live wires these to
 *  the storefront cart/capture APIs; the canvas leaves them as no-ops. */
export interface BuilderRuntime {
  /** Add a resolved variant to the active cart (and surface the cart drawer). */
  addToCart: (variantId: string, quantity: number) => Promise<void>;
  /** Add a resolved variant and proceed straight to checkout (the "Buy now" path).
   *  Live navigates to the cart/checkout; the canvas leaves it inert. */
  buyNow: (variantId: string, quantity: number) => Promise<void>;
  /** Subscribe an email address to the tenant's list via the public capture endpoint. */
  subscribeEmail: (email: string) => Promise<void>;
  /** Submit a ContactForm to the public forms endpoint. Live posts + resolves the
   *  form's routing config server-side; the canvas no-ops it so the form validates
   *  and shows its thank-you in preview without capturing anything. */
  submitForm: (input: BuilderFormSubmit) => Promise<void>;
  /** The customer session, for the AccountMenu island. Optional: only the live
   *  storefront supplies it; the canvas leaves it undefined. */
  account?: BuilderAccount;
}

// The canvas default: every effect is an inert resolved promise, so an island that
// fires one in edit mode simply does nothing (no provider required).
const NOOP_RUNTIME: BuilderRuntime = {
  addToCart: () => Promise.resolve(),
  buyNow: () => Promise.resolve(),
  subscribeEmail: () => Promise.resolve(),
  submitForm: () => Promise.resolve(),
};

const BuilderRuntimeContext = React.createContext<BuilderRuntime>(NOOP_RUNTIME);

/** Read the active runtime — the real storefront effects under a provider, the
 *  no-op default otherwise (the editor canvas). Always safe to call. */
export function useBuilderRuntime(): BuilderRuntime {
  return React.useContext(BuilderRuntimeContext);
}

/** Wraps a live render tree to supply real storefront effects. Mounted once in
 *  apps/site, inside the cart/customer providers it bridges to. */
export function BuilderRuntimeProvider({
  runtime,
  children,
}: {
  runtime: BuilderRuntime;
  children: React.ReactNode;
}) {
  return (
    <BuilderRuntimeContext.Provider value={runtime}>{children}</BuilderRuntimeContext.Provider>
  );
}

// `true` ⇒ this tree is the editor CANVAS, not a live page. Islands read it to
// drop effects a click-shield can't stop — chiefly a carousel autoplay timer that
// would fight the author trying to select a slide. Default `false` ⇒ live.
const EditModeContext = React.createContext(false);

/** Whether the surrounding tree is the editor canvas (vs a live page). */
export function useEditMode(): boolean {
  return React.useContext(EditModeContext);
}

/** Marks its subtree as the editor canvas, so interactive islands suppress the
 *  ambient effects (timers, observers) a click-shield can't neutralize. */
export function EditModeProvider({ children }: { children: React.ReactNode }) {
  return <EditModeContext.Provider value={true}>{children}</EditModeContext.Provider>;
}
