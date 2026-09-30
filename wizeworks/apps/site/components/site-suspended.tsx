import { GeistSans } from 'geist/font/sans';

import { SUSPENDED_BODY, SUSPENDED_HEADING } from '@/lib/suspended';

// The public "site unavailable" overlay (docs/17 §6). Served by the storefront root
// layout — as the WHOLE document, short-circuiting all storefront chrome + data
// fetches — when a tenant's billing lapses past its grace window (billingPhase ===
// 'suspended'). Reactivating (adding a card) lifts it with no rebuild, no data loss.
//
// Three hard constraints shape it:
//  1. It NEVER exposes a billing problem to the tenant's customers. A visitor sees a
//     neutral, friendly "back soon" — not "this business didn't pay". No sparx logo
//     either: a platform-branded takeover of a tenant's dark site would advertise
//     exactly that. Understated protects the tenant's dignity.
//  2. It carries NO platform wordplay either. The heading read "Catching a fresh
//     spark", and the spark is the sparx mark — so the logo was taken out and the
//     same advertisement left behind in words, on a page this file is shared far
//     enough to serve a Denver clothing label under a different brand entirely. It
//     also said nothing: a shopper who wanted a shirt needs "back soon", not a pun
//     about a platform they have never heard of.
//  3. It is SELF-CONTAINED. The suspended path skips the tenant's theme CSS, so this
//     depends on nothing tenant-scoped: standard Tailwind neutrals only, no `--st-*`
//     / `--color-*` bridge tokens, no brand-token colors that would render blank
//     without the theme injected.
//
// The two sentences are the only thing on the page, so they are set in the real ink
// rather than a grey: hierarchy here is scale and weight, and there is nothing on
// this page that is not meant to be read.
//
// THE WORDS ARE NOT HERE. They live in lib/suspended beside the 503 the edge
// proxy serves, because a dark page is drawn in two places and a copy edit to one
// of them is invisible in the other. This path is the BACKSTOP: the proxy answers
// every dark document it can identify, and this catches the rest — a custom
// domain, or a lookup that could not be made — still with the right words, just
// without the status code nobody but a crawler reads.

export function SiteSuspended() {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 font-sans text-neutral-900">
        <main className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{SUSPENDED_HEADING}</h1>
          <p className="mt-3 text-base leading-relaxed">{SUSPENDED_BODY}</p>
        </main>
      </body>
    </html>
  );
}
