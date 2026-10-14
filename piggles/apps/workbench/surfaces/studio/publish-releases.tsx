'use client';

// Every time this site went live, and the way back to any of them.
//
// Putting the site back is the ONE action in this console that changes what visitors
// see with no publish step after it — so it is `danger`, it is confirmed, and the
// confirm says plainly that it takes effect immediately.
//
// It is whole-site rather than per document, and that is a decision: what is
// published is one connected thing — pages, the chrome around them, the pieces
// inside them — so it goes back all together or not at all.

import { Fragment } from 'react';
import { Badge, Button, useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useReleases, useRestoreRelease, type Release } from '../../lib/studio/publish-data';
import { PaneWaiting } from '../../components/pane-waiting';
import { TIME_CELL, versionClock, versionClockNote, versionDay } from './when';
import { currentReleaseLabel, restoreConfirmDetail } from './publish-words';
import { useSiteIsDark } from '../../lib/billing/site-live';
import { useReaderClock } from '../../lib/business-timezone';

export function PublishReleases() {
  const releases = useReleases();
  // A suspended site serves an overlay instead of its pages, so "what visitors
  // see" is nobody seeing anything. The restore itself is unaffected.
  const siteIsDark = useSiteIsDark();
  const restore = useRestoreRelease();
  const confirm = useConfirm();
  const toast = useToast();
  // Her business's clock, or this computer's until she sets one (issue 987).
  const { zone, device } = useReaderClock();
  const clock = zone ?? device;

  const putBack = async (release: Release) => {
    const when = `${versionDay(release.createdAt, clock)} at ${versionClock(release.createdAt, clock)}`;
    const ok = await confirm({
      title: 'Put your website back to this version?',
      description: restoreConfirmDetail(when, siteIsDark),
      confirmLabel: 'Put my website back',
      cancelLabel: 'Leave it as it is',
      color: 'danger',
    });
    if (!ok) return;
    try {
      await restore.mutateAsync(release.id);
      toast.add({ title: 'Your website has been put back', type: 'success' });
    } catch {
      toast.add({ title: 'That version could not be put back', type: 'error' });
    }
  };

  if (releases.isPending) return <PaneWaiting label="Finding your published versions…" />;
  const rows = releases.data ?? [];

  return (
    <section className="bg-base-100 rounded-lg p-3 shadow-sm">
      <h3 className="text-base-content mb-1 text-base font-medium">Every time you published</h3>
      <p className="text-base-content mb-2 text-sm">
        Your website goes back all together: pages, header and footer, and the pieces inside them
        are one connected thing.
      </p>
      {zone !== undefined ? (
        <p className="text-base-content mb-2 text-sm">
          {versionClockNote(zone, device, new Date())}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-base-content py-4 text-sm">
          You haven’t published yet. Once you do, every version appears here.
        </p>
      ) : (
        <ReleaseList
          rows={rows}
          pending={restore.variables ?? null}
          onPutBack={putBack}
          siteIsDark={siteIsDark}
          clock={clock}
        />
      )}
    </section>
  );
}

function ReleaseList({
  rows,
  pending,
  onPutBack,
  siteIsDark,
  clock,
}: {
  rows: Release[];
  pending: string | null;
  onPutBack: (release: Release) => Promise<void>;
  siteIsDark: boolean;
  clock: string;
}) {
  let lastDay = '';
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((release) => {
        const day = versionDay(release.createdAt, clock);
        const heading = day === lastDay ? null : day;
        lastDay = day;
        return (
          <Fragment key={release.id}>
            {heading ? (
              <li className="text-base-content px-1 pt-3 text-sm font-medium">{heading}</li>
            ) : null}
            <ReleaseRow
              release={release}
              pending={pending === release.id}
              onPutBack={onPutBack}
              siteIsDark={siteIsDark}
              clock={clock}
            />
          </Fragment>
        );
      })}
    </ul>
  );
}

function ReleaseRow({
  release,
  pending,
  onPutBack,
  siteIsDark,
  clock,
}: {
  release: Release;
  pending: boolean;
  onPutBack: (release: Release) => Promise<void>;
  siteIsDark: boolean;
  clock: string;
}) {
  return (
    <li className="flex items-center gap-2 px-1 py-1">
      <span className={TIME_CELL}>{versionClock(release.createdAt, clock)}</span>
      <Badge color={release.source === 'restore' ? 'warning' : 'info'} variant="soft">
        {release.source === 'restore' ? 'Put back' : 'Published'}
      </Badge>
      {/* Never truncated: "21 pages" is three words long and is the only thing
          on the row that says HOW MUCH went live. It was shrinking to "21 pa…"
          the moment the label beside it grew. */}
      <span className="text-base-content shrink-0 text-sm whitespace-nowrap">
        {release.pageCount} {release.pageCount === 1 ? 'page' : 'pages'}
      </span>
      <span className="ml-auto shrink-0">
        {release.current ? (
          <span className="text-base-content text-sm">{currentReleaseLabel(siteIsDark)}</span>
        ) : (
          <Button
            size="sm"
            color="danger"
            disabled={pending}
            onClick={() => void onPutBack(release)}
          >
            {pending ? 'Putting back…' : 'Put my site back to this'}
          </Button>
        )}
      </span>
    </li>
  );
}
