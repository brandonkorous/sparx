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
import { CLOCK, DAY, TIME_CELL } from './when';

export function PublishReleases() {
  const releases = useReleases();
  const restore = useRestoreRelease();
  const confirm = useConfirm();
  const toast = useToast();

  const putBack = async (release: Release) => {
    const when = `${DAY.format(new Date(release.createdAt))} at ${CLOCK.format(new Date(release.createdAt))}`;
    const ok = await confirm({
      title: 'Put your website back to this version?',
      description: `Visitors will see the site exactly as it was on ${when}, straight away — there is no publish step after this. Everything you have been working on since stays where it is, unpublished.`,
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
        Your website goes back all together — pages, header and footer, and the pieces inside them
        are one connected thing.
      </p>

      {rows.length === 0 ? (
        <p className="text-base-content py-4 text-sm">
          You haven’t published yet. Once you do, every version appears here.
        </p>
      ) : (
        <ReleaseList rows={rows} pending={restore.variables ?? null} onPutBack={putBack} />
      )}
    </section>
  );
}

function ReleaseList({
  rows,
  pending,
  onPutBack,
}: {
  rows: Release[];
  pending: string | null;
  onPutBack: (release: Release) => Promise<void>;
}) {
  let lastDay = '';
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((release) => {
        const day = DAY.format(new Date(release.createdAt));
        const heading = day === lastDay ? null : day;
        lastDay = day;
        return (
          <Fragment key={release.id}>
            {heading ? (
              <li className="text-base-content px-1 pt-3 text-sm font-medium">{heading}</li>
            ) : null}
            <ReleaseRow release={release} pending={pending === release.id} onPutBack={onPutBack} />
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
}: {
  release: Release;
  pending: boolean;
  onPutBack: (release: Release) => Promise<void>;
}) {
  return (
    <li className="flex items-center gap-2 px-1 py-1">
      <span className={TIME_CELL}>{CLOCK.format(new Date(release.createdAt))}</span>
      <Badge color={release.source === 'restore' ? 'warning' : 'info'} variant="soft">
        {release.source === 'restore' ? 'Put back' : 'Published'}
      </Badge>
      <span className="text-base-content truncate text-sm">
        {release.pageCount} {release.pageCount === 1 ? 'page' : 'pages'}
      </span>
      <span className="ml-auto shrink-0">
        {release.current ? (
          <span className="text-base-content text-sm">This is what visitors see</span>
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
