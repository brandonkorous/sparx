'use client';

// What visitors are not getting yet, named one line at a time.
//
// Piggles improves a site's header and footer on its owner's behalf — the account
// link, the legal links, the brand mark are all rendered live by the platform, and a
// site whose chrome predates one of them is repaired the next time its owner opens
// the builder. That repair lands on the SAVED copy only. It is never pushed to a live
// site, which is right, and it means the improvement waits for a publish.
//
// Without this the only thing said about it was "your header and footer have changes"
// — about changes the owner did not make, cannot identify, and might reasonably undo.
//
// THIS PANE ANSWERS "WHAT HAPPENS IF I PUBLISH", so it must not claim a publish fixes
// something it cannot. A `waiting` gap is one the repair has not run for yet: her saved
// copy is as stale as her live site, there is nothing to publish, and the Publish button
// beside this is correctly disabled. Listing it under "until you publish" put two
// contradictory sentences on one screen (issue 315).
//
// THE PAGES ARE THE OTHER HALF, and they turned out to be the bigger one (issue 684). A
// product page is stamped from the catalog once, when the site is made, and never
// re-reads it, so a shop can be physically unable to tell a customer that something is
// sold out. Measured the day this shipped: **0 of the 13 live product pages on the
// platform could say it**, and every one of them kept a working Add-to-cart button on a
// product with nothing behind it.
//
// The page half gets a BUTTON where the chrome half gets a sentence, and that is the
// one real difference between them. "Open your header and footer" is an instruction an
// owner can follow because there is one header. There is no single page to send her to,
// so the repair is offered outright and she is left with something to publish.

import { Alert, AlertActions, AlertContent, Button } from '@wizeworks/silicaui-react';
import { useRepairPages, type PublishState } from '../../lib/studio/publish-data';

function Gaps({ says, gaps }: { says: string; gaps: { key: string; says: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p>{says}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {gaps.map((gap) => (
          <li key={gap.key}>{gap.says}</li>
        ))}
      </ul>
    </div>
  );
}

/** What the live PAGES cannot say, and the one button that starts fixing it.
 *
 *  Both sources land in the same alert, unlike the chrome half above, because the
 *  remedy is the same for both: a `waiting` page needs the repair and then a publish,
 *  a `saved` page needs only the publish, and the button knows which. Splitting them
 *  would put two boxes on the screen that say nearly the same thing. */
function PageGaps({ state }: { state: PublishState | null }) {
  const repair = useRepairPages();
  const gaps = state?.livePageGaps ?? [];
  if (gaps.length === 0) return null;

  // One un-repaired page decides it. Publishing would send that page back out
  // unchanged, so the repair has to run first or the button lies (issue 315).
  const waiting = gaps.some((gap) => gap.source === 'waiting');

  const lines = (
    <Gaps
      says={
        waiting
          ? 'Your product pages were built when your site was made, and they have not caught up. Right now they cannot tell a customer:'
          : 'These are already in your saved pages. Your live site does not have them until you publish:'
      }
      gaps={gaps.map((gap) => ({
        key: gap.ref,
        says: gap.pages > 1 ? `${gap.says} (on ${gap.pages} of your pages)` : gap.says,
      }))}
    />
  );

  // No button means NO `AlertContent` either, and the two alerts above are why: they
  // pass their lines as a bare child and stand 82px tall. Wrapped in `AlertContent`
  // with nothing beside it, the same lines came out 222px — the content part stretches
  // to fill a row it is the only thing in, so the panel grew 140px of empty amber.
  // Measured on the pane rather than reasoned about.
  if (!waiting) {
    return (
      <Alert color="warning" variant="soft">
        {lines}
      </Alert>
    );
  }

  return (
    <Alert color="warning" variant="soft" className="flex-col @[34rem]:flex-row">
      <AlertContent>{lines}</AlertContent>
      <AlertActions>
        <Button
          size="sm"
          color="warning"
          disabled={repair.isPending}
          onClick={() => {
            repair.mutate(undefined);
          }}
        >
          Bring my pages up to date
        </Button>
      </AlertActions>
    </Alert>
  );
}

export function PublishGaps({ state }: { state: PublishState | null }) {
  const gaps = state?.liveChromeGaps ?? [];
  const pageGaps = state?.livePageGaps ?? [];
  if (gaps.length === 0 && pageGaps.length === 0) return null;

  const saved = gaps.filter((gap) => gap.source === 'saved');
  const waiting = gaps.filter((gap) => gap.source === 'waiting');

  return (
    <section className="bg-base-100 rounded-lg p-3 shadow-sm">
      <h3 className="text-base-content mb-2 text-base font-medium">
        Your visitors are not getting these yet
      </h3>
      <div className="flex flex-col gap-2">
        {saved.length > 0 && (
          <Alert color="warning" variant="soft">
            <Gaps
              says="These are already in your saved header and footer. Your live site does not have them until you publish."
              gaps={saved.map((gap) => ({ key: gap.core, says: gap.says }))}
            />
          </Alert>
        )}
        {waiting.length > 0 && (
          <Alert color="info" variant="soft">
            {/* Names the pane that actually fixes it. Publishing from here would send
                the same header back out unchanged. */}
            <Gaps
              says="These are not in your saved header and footer yet, so publishing will not add them. Open Header & footer and we will put them in for you, then publish from there."
              gaps={waiting.map((gap) => ({ key: gap.core, says: gap.says }))}
            />
          </Alert>
        )}
        <PageGaps state={state} />
      </div>
    </section>
  );
}
