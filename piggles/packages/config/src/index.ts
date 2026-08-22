// @piggles/config — the Piggles product adapters.
//
// Terminology, the app registry, and product identity: the three things that
// make Piggles a different PRODUCT while running on the same platform as sparx.
//
// The point of this package is that brand differences are DATA. A shared surface
// or a Piggles shell component reads from here; it never branches on brand
// (piggles/CLAUDE.md RULE #0). If you find yourself writing
// `brand === 'piggles' ? … : …` anywhere, the value belongs in this package.
//
// What is NOT here, deliberately:
//   • Color — that is `@piggles/brand`, which owns the tokens and the six group
//     hues. This package owns which GROUP an app is in; brand owns what that
//     group looks like.
//   • Entitlement — nothing here answers "did they pay for this". Every app is
//     included in the subscription; `defaultEnabled` is a workspace default.
//   • Pricing — the console never knows a price.

export * from './apps';
export * from './app-index';
export * from './app-icons';
export * from './lexicon';
export * from './notice';
export * from './normalize-email';
export * from './product';
export * from './safe-path';
