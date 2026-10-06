'use client';

// Her live site is behind what the platform can now say, and she has no reason to know.
//
// A product page is stamped from the catalog ONCE, when the site is made, and never
// re-reads it. Every later improvement to the buy box (sold out, a preorder date, a
// core deposit, "send the old part first") lands only when a repair rewrites the
// page's SAVED copy, and reaches visitors only when she publishes. The server has
// worked out exactly what each live page cannot say (`livePageGaps` on the publish
// state) since issue 684, and this console fetched it and drew nothing.
//
// Measured on Gillett Diesel, 2026-10-01 (sparx persona issue 060): his Bosch
// injector page showed $600.00 and a plain Add to cart. The cart then added the
// $150.00 core deposit he had set, so a buyer saw one price and paid another, and
// nothing anywhere told him. Piggles has carried this offer since issue 684.
//
// TWO ROADS, TWO BUTTONS. A `saved` gap is already in the saved copy, so publishing
// fixes it. A `waiting` gap is not: publishing would send the same stale page back
// out, so the repair runs first and then she is sent to publish. One button for both
// sent the second owner to a disabled control (Piggles issue 315).
//
// PAGES BEFORE CHROME. A header missing its account link inconveniences a visitor; a
// page that cannot show a deposit charges a customer more than it said.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { ModuleScope } from '../../components/module-scope';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { usePublishState, useRepairPages, type SitePublishState } from './studio/data';

type PageGap = SitePublishState['livePageGaps'][number];

function pageLine(gap: PageGap): string {
  return gap.pages > 1 ? `${gap.says} (on ${String(gap.pages)} of your pages)` : gap.says;
}

const PAGE_ROADS = {
  saved: {
    title: 'Your live site is behind the pages you have saved',
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

/** The site builder opens with every page and the header and footer repaired, so
 *  both chrome roads end in the same place: open it (`builder.studio`, the Editor; `builder.site` is Site identity) and publish. */
const CHROME_ROADS = {
  saved: {
    title: 'Your live site is behind the one you have saved',
    lead: 'Until you publish, the people visiting your site do not get these:',
    close: 'Publishing puts them on your site. Nothing you have written changes.',
    action: 'Review and publish',
  },
  waiting: {
    title: 'Your header and footer can do more than they are',
    lead: 'The people visiting your site do not get these yet:',
    close:
      'Open your site editor and we will put them in for you. Publish from there and your visitors have them. Nothing you have written changes.',
    action: 'Open my site editor',
  },
} as const;

/**
 * The offer on Start here. Renders nothing when the live site already says
 * everything, which is the usual case and must cost a reader nothing.
 */
export function SiteBehindOffer({ ctx }: { ctx: SurfaceContext }) {
  const { data } = usePublishState();
  const repairPages = useRepairPages();
  // Never published is a different sentence, and the builder already leads with it.
  if (!data || data.neverPublished) return null;
  const openSite = () => {
    ctx.open('builder.studio', {}, { target: 'tab' });
  };

  if (data.livePageGaps.length > 0) {
    const waiting = data.livePageGaps.some((gap) => gap.source === 'waiting');
    const road = waiting ? PAGE_ROADS.waiting : PAGE_ROADS.saved;
    return (
      <ModuleScope module="builder">
        {/* Soft, so the solid warning button is the thing on it to press. Solid on solid
            was the same orange twice, and the button read as a line of text. Matches the
            setup banner directly above it on Start here. */}
        <Alert color="warning" variant="soft" className="flex-col text-base @[34rem]:flex-row">
          <AlertContent>
            <AlertTitle>{road.title}</AlertTitle>
            <AlertDescription>
              <p>{road.lead}</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {data.livePageGaps.map((gap) => (
                  <li key={gap.ref}>{pageLine(gap)}</li>
                ))}
              </ul>
              <p className="mt-2">{road.close}</p>
              {repairPages.isError ? (
                <p className="mt-2 font-medium">
                  Your pages could not be brought up to date just now. Nothing was changed. Try
                  again in a moment.
                </p>
              ) : null}
            </AlertDescription>
          </AlertContent>
          <AlertActions>
            <Button
              size="sm"
              color="warning"
              disabled={repairPages.isPending}
              onClick={() => {
                // The waiting road PROMISES the repair, so it runs first and she is sent
                // to publish only once it has landed. Otherwise she arrives at a site
                // that still holds the stale page.
                if (waiting) {
                  void repairPages.mutateAsync().then(openSite, () => undefined);
                  return;
                }
                openSite();
              }}
            >
              {repairPages.isPending ? 'Bringing them up to date…' : road.action}
            </Button>
          </AlertActions>
        </Alert>
      </ModuleScope>
    );
  }

  if (data.liveChromeGaps.length === 0) return null;
  const road = data.liveChromeGaps.some((gap) => gap.source === 'waiting')
    ? CHROME_ROADS.waiting
    : CHROME_ROADS.saved;
  return (
    <ModuleScope module="builder">
      <Alert color="module" variant="soft" className="flex-col text-base @[34rem]:flex-row">
        <AlertContent>
          <AlertTitle>{road.title}</AlertTitle>
          <AlertDescription>
            <p>{road.lead}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {data.liveChromeGaps.map((gap) => (
                <li key={gap.core}>{gap.says}</li>
              ))}
            </ul>
            <p className="mt-2">{road.close}</p>
          </AlertDescription>
        </AlertContent>
        <AlertActions>
          <Button size="sm" color="module" onClick={openSite}>
            {road.action}
          </Button>
        </AlertActions>
      </Alert>
    </ModuleScope>
  );
}

/**
 * The same facts inside the site builder, above the canvas, so the Publish button
 * beside it is not a guess.
 *
 * No repair button here: opening the builder ran the repair on every page and on the
 * header and footer, so whatever is listed is in the saved copy now and one publish
 * puts it live. The publish state is re-read once the site has loaded, because it is
 * fetched alongside the site and can describe the pages from before that repair.
 */
export function StudioLiveGaps({ state }: { state: SitePublishState }) {
  if (state.neverPublished) return null;
  const lines = [
    ...state.livePageGaps.map((gap) => ({ key: gap.ref, says: pageLine(gap) })),
    ...state.liveChromeGaps.map((gap) => ({ key: gap.core, says: gap.says })),
  ];
  if (lines.length === 0) return null;
  return (
    <Alert color="warning" variant="soft" className="rounded-none text-base">
      <AlertContent>
        <AlertTitle>Your visitors are not getting these yet</AlertTitle>
        <AlertDescription>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            {lines.map((line) => (
              <li key={line.key}>{line.says}</li>
            ))}
          </ul>
          <p className="mt-2">
            They are in your saved site now. Publish and your visitors have them. Nothing you have
            written changes.
          </p>
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
