'use client';

// The activity feed card: the long half of Pulse. Walked by keyset cursor, not
// offset, because the audit log is live and append-only (lib/api/activity.ts).

import { useState } from 'react';
import { Skeleton, Text } from '@wizeworks/silicaui-react';
import { faWavePulse } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { FormSection } from '../../components/form-section';
import { ListPagination, type PageSize } from '../../components/list-pagination';
import { useActivity, type ActivityFeed as Feed } from '../../lib/api/activity';
import { productCopy } from '../../lib/product';
import { ActivityList } from './activity-feed-rows';

/** Registry module for this surface, so the brand draws one consistent picture
 *  in its empty, waiting and failed states. */
const MODULE = 'platform';

const ICON = <Icon glyph={faWavePulse} className="size-6" aria-hidden />;

// One cursor per step back in time; empty is the newest window. A stack, so
// "Newer" is a pop: walking back toward now needs the window before's boundary.
function useFeedWindow() {
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [cursors, setCursors] = useState<string[]>([]);
  const before = cursors[cursors.length - 1];
  const feed = useActivity({ limit: pageSize, ...(before ? { before } : {}) });
  return { feed, pageSize, setPageSize, cursors, setCursors };
}

type FeedWindow = ReturnType<typeof useFeedWindow>;

function FeedLoadFailed({ feed }: { feed: Feed }) {
  return (
    <FormSection title="What's happened">
      <PaneLoadError
        icon={ICON}
        title="Could not load what's happened"
        description="This is a problem reaching the server. Nothing in your history is affected. It just could not be read."
        error={feed.error}
        onRetry={feed.retry}
      />
    </FormSection>
  );
}

function FeedEmpty({ hasJobs }: { hasJobs: boolean }) {
  return (
    <FormSection title="What's happened">
      {/* No Card: the FormSection is one, and this is the pane's main content. */}
      <PaneEmpty
        module={MODULE}
        icon={ICON}
        title="Nothing has happened yet"
        description={
          hasJobs
            ? 'Once pages get published, orders come in or records are imported, every one of those shows up here, newest first.'
            : 'Publishing a page, taking an order, importing records: it all shows up here, newest first.'
        }
      />
    </FormSection>
  );
}

function FeedBody({ feed, stepped }: { feed: Feed; stepped: boolean }) {
  if (!feed.ready) {
    return (
      <div
        className="flex flex-col gap-3 py-2"
        role="status"
        aria-label="Loading what has happened"
      >
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  // A full last window can leave the cursor one step past the end. Not an error,
  // and not the same as an empty log.
  if (stepped && feed.items.length === 0) {
    return (
      <Text className="py-2">
        Nothing older to show. Step back to Newer for the most recent activity.
      </Text>
    );
  }
  return <ActivityList items={feed.items} />;
}

function FeedPager({ win }: { win: FeedWindow }) {
  const { feed, pageSize, cursors, setCursors } = win;
  return (
    <ListPagination
      shown={feed.items.length}
      // Every prior window was full (we only step older when it was).
      firstRow={cursors.length * pageSize + 1}
      page={cursors.length + 1}
      pageSize={pageSize}
      busy={feed.busy}
      hasMore={feed.hasMore}
      onOlder={() => {
        const last = feed.items[feed.items.length - 1];
        if (last) setCursors((current) => [...current, last.at]);
      }}
      {...(cursors.length > 0
        ? {
            onNewer: () => {
              setCursors((current) => current.slice(0, -1));
            },
          }
        : {})}
      onPageSizeChange={(size) => {
        // Window boundaries move, so every cursor is meaningless: back to newest.
        win.setPageSize(size);
        setCursors([]);
      }}
    />
  );
}

export function ActivityFeed({ hasJobs }: { hasJobs: boolean }) {
  const win = useFeedWindow();
  const { feed, cursors } = win;
  // Only when nothing is on screen: a failed poll over rows still showing leaves them be.
  if (feed.failed && feed.items.length === 0) return <FeedLoadFailed feed={feed} />;
  if (feed.ready && feed.items.length === 0 && cursors.length === 0) {
    return <FeedEmpty hasJobs={hasJobs} />;
  }
  return (
    <FormSection
      title="What's happened"
      description={productCopy(
        'pulse.activity.description',
        'Everything that has happened in your business, newest first.'
      )}
    >
      <FeedBody feed={feed} stepped={cursors.length > 0} />
      <FeedPager win={win} />
    </FormSection>
  );
}
