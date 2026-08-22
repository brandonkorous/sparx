// The storefront's 404 — a page a TENANT'S OWN CUSTOMER reads.
//
// ── WHY THIS IS NOT A GENERIC ERROR PAGE ────────────────────────────────────
//
// Somebody mistyped an address, or followed a link that has moved, on a real
// business's website. They are not a developer and nothing has gone wrong with
// their computer. What they want is to get on with what they came for, and the
// only thing that helps is a way back into the shop.
//
// This renders INSIDE the tenant's own layout, so the header, footer, colours
// and type are theirs — which means the shop's navigation and its contact
// details are already on the page, underneath these words. That is the real
// answer to "offer the shop and the hours rather than an apology": not a bigger
// apology, but a page that is still their website.
//
// ── ONE OUTCOME, TWO CAUSES ─────────────────────────────────────────────────
//
// Next's not-found handler fires for two completely different situations, and
// they need different words because a reader can act on one and not the other:
//
//   the host resolves to a business, but the path has no page
//       → their address is fine; this particular page is not there. Offer the
//         way back to the front page.
//   the host resolves to NO business at all
//       → the address itself is wrong, or the site has not been set up on it.
//         There is no "back to home" that helps, because home is the thing that
//         does not exist. Saying "back to home" here sends them round a loop.
//
// It used to say "That page isn't published here" for both. "Published" is our
// word, not theirs — a customer does not know what publishing is, and reading it
// on a shop's website suggests the shop is broken rather than that they mistyped
// something.

import Link from 'next/link';
import { resolveSite } from '@/lib/site-context';

export default async function NotFound() {
  const site = await resolveSite();

  // No business on this address. Deliberately no "back to home" link: the home
  // page is exactly what is missing, so offering it is a loop.
  if (!site) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="text-base-content text-4xl font-semibold tracking-tight">
          There&rsquo;s no website on this address
        </h1>
        <p className="text-base-content text-lg">
          Check the address for a typo. If somebody gave you this link, it may have moved.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-base-content text-4xl font-semibold tracking-tight">
        We couldn&rsquo;t find that page
      </h1>
      <p className="text-base-content text-lg">
        It may have moved, or the address may have a typo in it. Everything else on {site.name} is
        still here.
      </p>
      <Link href="/" className="btn btn-primary btn-lg">
        Go to the front page
      </Link>
    </main>
  );
}
