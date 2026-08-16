import Link from 'next/link';
import { Icon } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { PigglesGroup } from '@piggles/brand';
import { Logo } from '@piggles/brand/react';
import { accountUrl, appIcon, appsInGroup, PRODUCT } from '@piggles/config';
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
//
// ── WHAT WAS WRONG WITH THE OLD ONE ─────────────────────────────────────────
//
// It was a link dump. Three specific failures, all fixable:
//
//   1. **Six groups in a three-column grid.** The groups hold one, two and three
//      apps, so the second row started at whatever height the tallest tile in
//      the first happened to be and the whole thing read as ragged. It is now a
//      four-column band — the brand and the ask on the left, the index in three
//      even columns beside it — with the six groups paired so each column
//      carries a similar amount.
//   2. **No job.** A footer is the last thing somebody sees before leaving, and
//      this one asked for nothing. It now carries the one action the site is for,
//      with the terms next to it, because the price is a long way up the page by
//      the time anybody gets here.
//   3. **No hierarchy.** Fifteen links, three nav links and a credit line, all
//      the same weight. The group headings now wear their hue and carry their
//      icon, which is the same wayfinding the rail uses — a person who has used
//      the product for a week reads this footer by color.
//
// One thing that has NOT changed and must not: every one of the fifteen is a
// real link. Trimming the index to "popular apps" would quietly undo the reason
// this component is heavy in the first place.

/** The six groups, paired so the three index columns carry a similar amount.
 *  `home` has one app and `money` two; pairing them with the three-app groups
 *  is what stops the columns going ragged. */
const COLUMNS: readonly (readonly PigglesGroup[])[] = [
  ['home', 'people'],
  ['web', 'money'],
  ['sell', 'run'],
];

export function SiteFooter() {
  return (
    // The top margin is the footer's own, not the last section's. Every page
    // ends on the dark close band, which sits in a rounded card with the page
    // ground showing around three of its sides — butting the footer straight
    // against it closed that fourth side and read as a page that had been cut
    // off rather than finished. The band now floats clear of the footer the same
    // way it floats clear of everything else.
    <div className="bg-base-100 border-base-300 mt-16 border-t sm:mt-16 lg:mt-16">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-4 lg:gap-16">
          {/* The ask. One column of four, so it reads as the footer's subject
              rather than as a strip bolted under the links. */}
          <div>
            <Link href="/" aria-label={`${PRODUCT.name} home`}>
              <Logo />
            </Link>
            <p className="mt-5 text-lg font-semibold">{PRODUCT.tagline}</p>
            {/* Both stacked and `block`, so they are one column of two equal
                bars rather than two pills of whatever width their labels
                happened to want. `block` is silica's own full-width mode
                (`btn-block`) — a `w-full` utility on top of the control would be
                painting over it. */}
            <div className="mt-6 flex flex-col gap-3">
              <a
                className={buttonClasses({ color: 'primary', size: 'lg', block: true })}
                href={accountUrl('signup', 'footer')}
              >
                Start free
              </a>
              <a
                className={buttonClasses({
                  variant: 'outline',
                  size: 'lg',
                  block: true,
                })}
                href={accountUrl('contact', 'footer')}
              >
                Talk to a person
              </a>
            </div>
            <p className="mt-4 text-base">$49 a month · 14 days free · no card needed</p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column[0]} className="grid gap-10">
              {column.map((group) => (
                <nav key={group} data-group={group}>
                  <h2 className="text-module text-base font-bold">{GROUP_COPY[group].title}</h2>
                  <ul className="mt-4 space-y-3">
                    {appsInGroup(group).map((app) => {
                      const glyph = appIcon(app.id);
                      return (
                        <li key={app.id}>
                          <Link href={`/apps/${app.id}`} className="flex items-center gap-2.5">
                            <span className="bg-module bg-soft text-module grid size-7 shrink-0 place-items-center rounded-md">
                              <Icon glyph={glyph} aria-hidden className="size-3.5" />
                            </span>
                            <span className="text-base">{app.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              ))}
            </div>
          ))}
        </div>

        {/* ── The utility row ─────────────────────────────────────────────────
            EVERY LINK HERE RESOLVES, and that is the whole rule for this row: a
            dead legal link is the one somebody clicks when they have decided to
            care, so a footer that 404s is worse than a short one.

            All nine exist. Add the tenth here the same day the thing itself
            does — never the other way round. */}
        <div className="border-base-300 mt-16 grid gap-6 border-t pt-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <nav className="flex flex-wrap gap-x-7 gap-y-3">
            <Link href="/apps" className="text-base font-semibold">
              All apps
            </Link>
            <Link href="/pricing" className="text-base font-semibold">
              Pricing
            </Link>
            <Link href="/tools" className="text-base font-semibold">
              Free tools
            </Link>
            <Link href="/trust" className="text-base font-semibold">
              Trust
            </Link>
            <Link href="/status" className="text-base font-semibold">
              Status
            </Link>
            <Link href="/terms" className="text-base font-semibold">
              Terms
            </Link>
            <Link href="/privacy" className="text-base font-semibold">
              Privacy
            </Link>
            <Link href="/cookies" className="text-base font-semibold">
              Cookies
            </Link>
            <a href={accountUrl('contact', 'footer-utility')} className="text-base font-semibold">
              Contact
            </a>
            <Link href="/brand" className="text-base font-semibold">
              Brand
            </Link>
          </nav>
          <p className="text-base lg:text-right">
            © {new Date().getFullYear()} WizeWorks LLC · {PRODUCT.hosts.marketing}
          </p>
        </div>
      </div>
    </div>
  );
}
