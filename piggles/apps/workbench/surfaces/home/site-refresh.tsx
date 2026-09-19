'use client';

// Her live site is behind her saved one, and she has no reason to know it.
//
// Piggles renders parts of a site's header and footer itself — the account link, the
// legal links, the brand mark — and repairs chrome that predates one of them when its
// owner opens the builder. The repair never touches a live site, which is right, so the
// improvement waits for a publish that may never come. An owner who installed a design,
// liked it, and never went back to the builder kept the day-one header forever, and the
// only place that was ever mentioned was inside the builder she was not opening
// (issue 313).
//
// TWO WAYS TO BE BEHIND, AND THEY NEED DIFFERENT BUTTONS. If her saved copy already has
// it, publishing puts it live. If nothing has run yet, publishing republishes the same
// stale tree and fixes nothing — the repair runs when the header and footer is opened.
// One button for both sent the second owner to a disabled control (issue 315).
//
// A sibling of the template-update offer, and here for the same reason: nothing is late
// and nothing is waiting on her, so it is an offer rather than a line in "What needs you".
//
// HER PAGES CAN BE BEHIND TOO, and that half is worse (issue 684). A product page is
// stamped from the catalog once, when the site is made, and never re-reads it, so a
// shop can be physically unable to tell a customer that something is sold out.
// Measured the day this shipped: **0 of the 13 live product pages on the platform
// could say it**, every one of them with a working Add-to-cart button on a product
// with nothing behind it, and not one owner told.
//
// PAGES FIRST when both are behind. A header missing its account link is a visitor
// inconvenienced; a page that cannot say "sold out" is a customer paying for something
// that is not there. Only one offer shows at a time, because two boxes on Home saying
// "your site is behind" is a wall she scrolls past.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { ModuleScope } from '@/components/module-scope';
import type { SurfaceContext } from '@/lib/surfaces/registry';
import { usePublishState, useRepairPages } from '@/lib/studio/publish-data';
import { useRepairChrome } from '@/lib/studio/repair-chrome';

/** What to say and where to send her, per the road that actually gets her there. */
const ROADS = {
  saved: {
    title: 'Your live site is behind the one you have saved',
    lead: 'Until you publish, the people visiting your site do not get these:',
    close: 'Publishing puts them on your site. Nothing you have written changes.',
    action: 'Review and publish',
    surface: 'builder.publish',
  },
  waiting: {
    title: 'Your header and footer can do more than they are',
    lead: 'The people visiting your site do not get these yet:',
    // Deliberately says what the click DOES. "Open it and we will add them" is the
    // honest description of a repair that runs on open, and it sets up the Publish
    // she will find waiting on that pane.
    close:
      'Open your header and footer and we will put them in for you. Publish from there and your visitors have them. Nothing you have written changes.',
    action: 'Open my header and footer',
    surface: 'builder.layout',
  },
} as const;

/** What to say about PAGES, per the road that actually gets her there.
 *
 *  The `waiting` road cannot say "open the page", the way the chrome road can say
 *  "open your header and footer": a site has many pages, and the stale one is usually
 *  a record template she has never had a reason to look at. So it offers the repair
 *  outright and leaves her at Publish. */
const PAGE_ROADS = {
  saved: {
    title: 'Your live shop is behind the pages you have saved',
    lead: 'Until you publish, your product pages cannot tell a customer:',
    close: 'Publishing puts them on your site. Nothing you have written changes.',
    action: 'Review and publish',
  },
  waiting: {
    title: 'Your product pages have not caught up with your shop',
    lead: 'They were built when your site was made. Right now they cannot tell a customer:',
    close:
      'We can bring them up to date for you, then you publish. Nothing you have written changes.',
    action: 'Bring my pages up to date',
  },
} as const;

/** Renders nothing when the live site already has everything, which is the usual
 *  case and the one this must cost a reader nothing in. */
export function SiteRefreshPanel({ ctx }: { ctx: SurfaceContext }) {
  const { data } = usePublishState();
  const repair = useRepairChrome();
  const repairPages = useRepairPages();
  const gaps = data?.liveChromeGaps ?? [];
  const pageGaps = data?.livePageGaps ?? [];
  // Never published is a different sentence entirely, and the Publish pane already
  // leads with it. Saying "your live site is behind" about a site nobody can reach
  // would be the wrong end of the problem.
  if (data?.neverPublished) return null;

  // PAGES FIRST. A header missing its account link inconveniences a visitor; a page
  // that cannot say "sold out" takes their money for a thing that is not there.
  if (pageGaps.length > 0) {
    const road = pageGaps.some((gap) => gap.source === 'waiting')
      ? PAGE_ROADS.waiting
      : PAGE_ROADS.saved;
    return (
      <ModuleScope module="builder">
        <Alert color="warning" className="mt-6 flex-col text-base @[34rem]:flex-row">
          <AlertContent>
            <AlertTitle>{road.title}</AlertTitle>
            <AlertDescription>
              <p>{road.lead}</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {pageGaps.map((gap) => (
                  <li key={gap.ref}>
                    {gap.pages > 1 ? `${gap.says} (on ${gap.pages} of your pages)` : gap.says}
                  </li>
                ))}
              </ul>
              <p className="mt-2">{road.close}</p>
            </AlertDescription>
          </AlertContent>
          <AlertActions>
            <Button
              size="sm"
              color="warning"
              disabled={repairPages.isPending}
              onClick={() => {
                // The `waiting` road PROMISES the repair, so it is asked for outright
                // and she is sent to Publish only once it has landed — otherwise she
                // arrives at a pane that still says her pages are behind.
                if (road === PAGE_ROADS.waiting) {
                  void repairPages
                    .mutateAsync()
                    .then(() => ctx.open('builder.publish', {}, { target: 'tab' }));
                  return;
                }
                ctx.open('builder.publish', {}, { target: 'tab' });
              }}
            >
              {road.action}
            </Button>
          </AlertActions>
        </Alert>
      </ModuleScope>
    );
  }

  if (gaps.length === 0) return null;

  // One `waiting` gap decides the whole panel: that road resolves the saved ones too
  // (the header and footer pane publishes), and the other road leaves it stranded.
  const road = gaps.some((gap) => gap.source === 'waiting') ? ROADS.waiting : ROADS.saved;

  return (
    <ModuleScope module="builder">
      {/* Stacked until the pane is wide enough for both, and solid rather than soft,
          for the reasons the template-update offer beside it documents. */}
      <Alert color="module" className="mt-6 flex-col text-base @[34rem]:flex-row">
        <AlertContent>
          <AlertTitle>{road.title}</AlertTitle>
          <AlertDescription>
            <p>{road.lead}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {gaps.map((gap) => (
                <li key={gap.core}>{gap.says}</li>
              ))}
            </ul>
            <p className="mt-2">{road.close}</p>
          </AlertDescription>
        </AlertContent>
        <AlertActions>
          <Button
            size="sm"
            disabled={repair.pending}
            onClick={() => {
              // The `waiting` road PROMISES the repair, so it is asked for outright
              // rather than left to ride along with the studio's read — that read runs
              // once and never again while the pane is open (issue 315). Opened AFTER it
              // lands, so she meets the repaired header rather than the one she was just
              // told about.
              if (road === ROADS.waiting) {
                void repair.run().then(() => ctx.open(road.surface, {}, { target: 'tab' }));
                return;
              }
              ctx.open(road.surface, {}, { target: 'tab' });
            }}
          >
            {road.action}
          </Button>
        </AlertActions>
      </Alert>
    </ModuleScope>
  );
}
