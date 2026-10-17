'use client';

// Publish: what is waiting to go live, what to look at first, and the way back. The whole-site
// counterpart to each builder's Publish, and the one place a site can be put back. It leads with WHAT
// IS WAITING; the check is offered, not run, because it walks every page and would make opening costly.

import { useState } from 'react';
import { Alert, Button, useToast } from '@wizeworks/silicaui-react';
import { faCloudArrowUp } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  usePublishSite,
  usePublishState,
  useSiteCheck,
  type PublishState,
  type SiteCheckReport,
} from '../../lib/studio/publish-data';
import { PublishChecks } from './publish-checks';
import { PublishGaps } from './publish-gaps';
import { PublishReleases } from './publish-releases';
import { waitingLine } from './publish-words';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useSiteIsDark } from '../../lib/billing/site-live';

type PageLink = NonNullable<PublishState['unpublishedPageList']>[number];

function usePublishFlow() {
  const publish = usePublishSite();
  const check = useSiteCheck();
  const toast = useToast();
  const [report, setReport] = useState<SiteCheckReport | null>(null);

  const runCheck = () => {
    void check
      .mutateAsync()
      .then(setReport)
      .catch(() => toast.add({ title: 'The check could not be run', type: 'error' }));
  };

  const goLive = () => {
    void publish
      .mutateAsync()
      .then((result) => {
        // A count nobody sent must never be rendered as one: if `pages` is ever absent, say the
        // true thing without it rather than "undefined pages are live" over a publish that worked.
        const count = typeof result.pages === 'number' ? result.pages : null;
        toast.add({
          title:
            count === null
              ? 'Your website is live'
              : `${String(count)} ${count === 1 ? 'page is' : 'pages are'} live`,
          type: 'success',
        });
        // The check described the site BEFORE this publish; keeping it on screen
        // would put a stale count beside a fresh result.
        setReport(null);
      })
      .catch(() => toast.add({ title: 'Your site could not be published', type: 'error' }));
  };

  return { publish, check, report, runCheck, goLive };
}

export function PublishPaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const state = usePublishState();
  const { publish, check, report, runCheck, goLive } = usePublishFlow();

  if (state.isPending) return <PaneWaiting label="Checking what is live…" />;

  return (
    <div className="bg-base-200 flex h-full min-h-0 flex-col gap-4 overflow-auto p-4 [&>*]:shrink-0">
      <Waiting
        state={state.data ?? null}
        publishing={publish.isPending}
        onPublish={goLive}
        onOpenPage={(pageId) => {
          ctx.open('builder.page', { pageId });
        }}
      />
      <PublishGaps state={state.data ?? null} />
      <PublishChecks report={report} running={check.isPending} onRun={runCheck} />
      <PublishReleases />
    </div>
  );
}

function WaitingPages({
  pages,
  onOpenPage,
}: {
  pages: PageLink[];
  onOpenPage: (pageId: string) => void;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {pages.map((page) => (
        <li key={page.id}>
          <Button
            size="sm"
            variant="soft"
            color="module"
            onClick={() => {
              onOpenPage(page.id);
            }}
          >
            {page.name}
            {page.slug ? (
              <span className="ms-1 font-mono">
                {page.slug.startsWith('/') ? page.slug : `/${page.slug}`}
              </span>
            ) : null}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** What is outstanding, and the one button that resolves it. */
function Waiting({
  state,
  publishing,
  onPublish,
  onOpenPage,
}: {
  state: PublishState | null;
  publishing: boolean;
  onPublish: () => void;
  onOpenPage: (pageId: string) => void;
}) {
  const pages = state?.unpublishedPageList ?? [];
  // Every sentence on this pane is written about VISITORS, and a suspended site
  // serves an overlay rather than its pages, so there are none to speak of.
  const siteIsDark = useSiteIsDark();
  return (
    <section className="bg-base-100 rounded-lg p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-base-content min-w-0 flex-1 basis-48">
          {state ? waitingLine(state, siteIsDark) : 'We could not check what is live right now.'}
        </p>
        <Button color="primary" disabled={publishing || !state?.hasUnpublished} onClick={onPublish}>
          <Icon glyph={faCloudArrowUp} className="size-4" aria-hidden />
          {publishing ? 'Publishing…' : 'Publish everything'}
        </Button>
      </div>
      {/* WHICH pages, not only how many: "13 pages have changes" left an owner who had edited five
          to publish all unseen, or none (persona issue 939). Each opens, so she can look first. */}
      {pages.length > 0 ? <WaitingPages pages={pages} onOpenPage={onOpenPage} /> : null}
      {state && !state.hasUnpublished ? (
        <Alert color="success" variant="soft" className="mt-3">
          There is nothing waiting. Anything you change from here will need publishing again.
        </Alert>
      ) : null}
    </section>
  );
}
