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

import { Alert } from '@wizeworks/silicaui-react';
import type { PublishState } from '../../lib/studio/publish-data';

function Gaps({ says, gaps }: { says: string; gaps: { core: string; says: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p>{says}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {gaps.map((gap) => (
          <li key={gap.core}>{gap.says}</li>
        ))}
      </ul>
    </div>
  );
}

export function PublishGaps({ state }: { state: PublishState | null }) {
  const gaps = state?.liveChromeGaps ?? [];
  if (gaps.length === 0) return null;

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
              gaps={saved}
            />
          </Alert>
        )}
        {waiting.length > 0 && (
          <Alert color="info" variant="soft">
            {/* Names the pane that actually fixes it. Publishing from here would send
                the same header back out unchanged. */}
            <Gaps
              says="These are not in your saved header and footer yet, so publishing will not add them. Open Header & footer and we will put them in for you, then publish from there."
              gaps={waiting}
            />
          </Alert>
        )}
      </div>
    </section>
  );
}
