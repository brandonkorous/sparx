'use client';

// Publish — what is waiting to go live, what to look at first, and the way back.
//
// The whole-site counterpart to the Publish button in each builder. Those are the
// day-to-day act: fix the footer, publish the footer. This is the other one — "put
// everything I've been working on live" — and the one place a site can be put back.
//
// It leads with WHAT IS WAITING, because that is the question someone opening this
// actually has. The check is offered, not run: it walks every page, and running it
// unasked would make opening this pane expensive for someone who only wanted to see
// whether anything was outstanding.

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
import { useSiteIsDark } from '../../lib/billing/site-live';

export function PublishPaneSurface() {
  const state = usePublishState();
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
        // A count nobody sent must never be rendered as one. The route now returns
        // `pages`, but a toast is the wrong place to find out it stopped: if the
        // number is ever absent, say the true thing without it rather than print
        // "undefined pages are live" over a publish that actually worked.
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

  if (state.isPending) return <PaneWaiting label="Checking what is live…" />;

  return (
    <div className="bg-base-200 flex h-full min-h-0 flex-col gap-4 overflow-auto p-4 [&>*]:shrink-0">
      <Waiting state={state.data ?? null} publishing={publish.isPending} onPublish={goLive} />
      <PublishGaps state={state.data ?? null} />
      <PublishChecks report={report} running={check.isPending} onRun={runCheck} />
      <PublishReleases />
    </div>
  );
}

/** What is outstanding, and the one button that resolves it. */
function Waiting({
  state,
  publishing,
  onPublish,
}: {
  state: PublishState | null;
  publishing: boolean;
  onPublish: () => void;
}) {
  // Every sentence on this pane is written about VISITORS, and a suspended site
  // serves an overlay rather than its pages — so there are none to speak of.
  const siteIsDark = useSiteIsDark();
  return (
    <section className="bg-base-100 rounded-lg p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-base-content min-w-0 flex-1">
          {state ? waitingLine(state, siteIsDark) : 'We could not check what is live right now.'}
        </p>
        <Button color="primary" disabled={publishing || !state?.hasUnpublished} onClick={onPublish}>
          <Icon glyph={faCloudArrowUp} className="size-4" aria-hidden />
          {publishing ? 'Publishing…' : 'Publish everything'}
        </Button>
      </div>
      {state && !state.hasUnpublished ? (
        <Alert color="success" variant="soft" className="mt-3">
          There is nothing waiting. Anything you change from here will need publishing again.
        </Alert>
      ) : null}
    </section>
  );
}
