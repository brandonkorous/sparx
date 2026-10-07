'use client';

// The line a builder pane shows the moment its own Publish went through.
//
// Each pane publishes ITS OWN document: a page, the header and footer, the look.
// The line used to read "Published. Your site shows it in a few seconds" whatever
// was published, so an owner who had edited five things and pressed Publish once
// read that her site was done. Four of the five were still waiting, and nothing on
// the screen said so (persona issue 939). It now names what went live and counts
// the pages still saved but not live, with the way to publish them.

import { Button } from '@wizeworks/silicaui-react';
import { usePublishState } from '../../lib/studio/publish-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { stillWaiting } from './published-words';

export function PublishedLine({
  what,
  ctx,
  catchingUp,
}: {
  /** What this pane published, as the start of a sentence: "This page". */
  what: string;
  ctx: SurfaceContext;
  /** The publish was moments ago, so visitors may not have it yet. */
  catchingUp: boolean;
}) {
  const state = usePublishState();
  const waiting = stillWaiting(state.data?.unpublishedPages ?? 0);
  return (
    <span>
      {catchingUp
        ? `${what} is published. Your site shows it in a few seconds, a few minutes at most.`
        : 'Saved and live.'}
      {waiting ? (
        <>
          {' '}
          {waiting}{' '}
          <Button
            size="sm"
            variant="link"
            color="module"
            onClick={() => {
              ctx.open('builder.publish');
            }}
          >
            Publish the rest
          </Button>
        </>
      ) : null}
    </span>
  );
}
