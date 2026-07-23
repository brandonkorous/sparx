import { GeistSans } from 'geist/font/sans';

// The public "site unavailable" overlay (docs/17 §6). Served by the storefront root
// layout — as the WHOLE document, short-circuiting all storefront chrome + data
// fetches — when a tenant's billing lapses past its grace window (billingPhase ===
// 'suspended'). Reactivating (adding a card) lifts it with no rebuild, no data loss.
//
// Two hard constraints shape it:
//  1. It NEVER exposes a billing problem to the tenant's customers. A visitor sees a
//     neutral, friendly "back soon" — not "this business didn't pay". No sparx logo
//     either: a platform-branded takeover of a tenant's dark site would advertise
//     exactly that. Understated protects the tenant's dignity.
//  2. It is SELF-CONTAINED. The suspended path skips the tenant's theme CSS, so this
//     depends on nothing tenant-scoped: standard Tailwind neutrals only, no `--st-*`
//     / `--color-*` bridge tokens, no brand-token colors that would render blank
//     without the theme injected.

export function SiteSuspended() {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 font-sans text-neutral-900">
        <main className="w-full max-w-md text-center">
          <p aria-hidden className="mx-auto mb-6 h-2 w-10 rounded-full bg-neutral-300" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Catching a fresh spark
          </h1>
          <p className="mt-3 text-base leading-relaxed text-neutral-500">
            This site is taking a short break and will be back shortly. Thanks for your patience —
            please check back soon.
          </p>
        </main>
      </body>
    </html>
  );
}
