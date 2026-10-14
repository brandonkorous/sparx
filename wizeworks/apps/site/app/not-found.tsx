// The storefront's 404 — a page a TENANT'S OWN CUSTOMER reads.
//
// ── WHY THIS IS NOT A GENERIC ERROR PAGE ────────────────────────────────────
//
// Somebody mistyped an address, or followed a link that has moved, on a real
// business's website. They are not a developer and nothing has gone wrong with
// their computer. What they want is to get on with what they came for, and the
// only thing that helps is a way back into the shop.
//
// This renders INSIDE the tenant's own layout, so the header, footer, colors
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveSite } from '@/lib/site-context';

// The tab and the first thing a screen reader says. It read only the business's
// name, the same as its front page, so a reader with several tabs open could not
// tell this one was a dead end (persona P09). The layout's title template adds
// the name: "Page not found · The Marrow Review". With no business on the address
// it keeps saying so, as the page below does.
export async function generateMetadata(): Promise<Metadata> {
  const site = await resolveSite();
  return { title: site ? 'Page not found' : { absolute: 'Site not found' } };
}

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
      {/* A way to the thing they were after, not only to the front page. Search reaches
          every page and every piece a site has published, on every site (it is not
          the shop's), so it is the archive this page can always offer (persona 947:
          a journal's 404 must offer its archive). */}
      <form action="/search" method="get" role="search" className="flex w-full max-w-md gap-2">
        <label htmlFor="not-found-search" className="sr-only">
          Search {site.name}
        </label>
        <input
          id="not-found-search"
          name="q"
          type="search"
          placeholder={`Search ${site.name}`}
          className="input w-full"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>
      <Link href="/" className="btn btn-outline btn-lg">
        Go to the front page
      </Link>
    </main>
  );
}
