import Link from 'next/link';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { Logo } from '@piggles/brand/react';
import { appsInGroup, PRODUCT } from '@piggles/config';
import { GROUP_COPY } from './groups';

// The footer carries the WHOLE app index — all fifteen, grouped, every one a
// link to its own page.
//
// That is deliberate rather than thorough-for-its-own-sake. The satellite sites
// (pigglescms.com and friends) exist to catch people searching the technical
// term and land them on the plain-language page for that app, so those pages
// need to be reachable and internally linked from every page on the site. A
// footer with three links and a copyright would leave fifteen pages hanging off
// one index.
//
// It also states the product's central claim structurally: you can see the whole
// thing at once, and it is grouped the way a business is, not the way a software
// catalogue is.

export function SiteFooter() {
  return (
    <div className="bg-base-200 border-base-300 border-t">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {PIGGLES_GROUPS.map((group) => (
            <nav key={group} data-group={group}>
              <h2 className="text-module text-base font-bold">{GROUP_COPY[group].title}</h2>
              <ul className="mt-3 space-y-2">
                {appsInGroup(group).map((app) => (
                  <li key={app.id}>
                    <Link href={`/apps/${app.id}`} className="text-base">
                      {app.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-base-300 mt-14 flex flex-wrap items-center justify-between gap-6 border-t pt-8">
          <Link href="/" aria-label={`${PRODUCT.name} home`}>
            <Logo />
          </Link>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/apps" className="text-base font-semibold">
              All apps
            </Link>
            <Link href="/pricing" className="text-base font-semibold">
              Pricing
            </Link>
            <Link href="/trust" className="text-base font-semibold">
              Trust
            </Link>
          </nav>
        </div>

        <p className="mt-8 text-base">
          {PRODUCT.hosts.marketing} · {PRODUCT.name} is made by WizeWorks.
        </p>
      </div>
    </div>
  );
}
