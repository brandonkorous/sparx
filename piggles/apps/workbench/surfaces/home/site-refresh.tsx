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
import { usePublishState } from '@/lib/studio/publish-data';
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

/** Renders nothing when the live site already has everything, which is the usual
 *  case and the one this must cost a reader nothing in. */
export function SiteRefreshPanel({ ctx }: { ctx: SurfaceContext }) {
  const { data } = usePublishState();
  const repair = useRepairChrome();
  const gaps = data?.liveChromeGaps ?? [];
  // Never published is a different sentence entirely, and the Publish pane already
  // leads with it. Saying "your live site is behind" about a site nobody can reach
  // would be the wrong end of the problem.
  if (gaps.length === 0 || data?.neverPublished) return null;

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
