'use client';

// Pulse — the live view of what the business is doing right now.
//
// The product-facing home of the awareness layer (docs/124). It carries three
// things; two are here:
//
//   • what's RUNNING  — background jobs, live, from GET /v1/jobs      (Phase 1)
//   • what HAPPENED   — the activity feed, from GET /v1/activity      (Phase 2)
//   • what NEEDS YOU  — notifications                                 (Phase 3)
//
// The surface was registered under its final key while it only had the first,
// because keys are persisted in saved layouts — growing this pane must never
// mean renaming it.
//
// Why this exists alongside the status-bar chip: the chip can only ever say
// "still going". It shows actives and, by construction, a job that finishes or
// fails simply disappears from it. This pane is where "did it actually work?"
// gets answered — finished runs, with their errors, are the whole point.
//
// LAYOUT: the same bento every edit panel wears (components/editor-layout.tsx),
// for the same reason — the two regions have different jobs, not equal weight.
// The feed is the point of the screen and grows without bound, so it takes the
// wide main column and owns the paging. Jobs are a glance ("is it done?"), so
// they sit in the rail, with the running ones pinned: a progress bar you have to
// scroll back to find is a progress bar you stop watching.
//
// No page heading. The pane's tab already says Pulse, and an <h1> repeating it
// would be the second identity docs/86 §5.1 rules out — the same reason the
// invoice editor has no "Invoice" heading above its form.

import { EditorLayout, EDITOR_RAIL_STICKY } from '../../components/editor-layout';
import { FormSection } from '../../components/form-section';
import { EmptyState, Text } from '@wizeworks/silicaui-react';
import { Coffee } from 'lucide-react';
import { useAllJobs } from '../../lib/api/jobs';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { ActivityFeed } from './activity-feed';
import { JobCard } from './job-card';
import { NeedsYou } from './needs-you';
import { productCopy } from '../../lib/product';

/** How many finished runs the tail shows. A tail, not a log: the full history
 *  lives in the run's own module, and five answers "did that finish?". */
const FINISHED_SHOWN = 5;

export function PulseSurface({ ctx }: { ctx: SurfaceContext }) {
  const jobs = useAllJobs();
  const running = jobs.filter((job) => job.status === 'running');
  const finished = jobs.filter((job) => job.status !== 'running');

  return (
    <div className="bg-base-200 h-full min-h-0 overflow-y-auto">
      <div className="p-4">
        <EditorLayout
          main={
            <>
              {/* Above the feed, and that ordering is the point: this is the
                  only one of Pulse's three regions ADDRESSED to the reader.
                  Activity is ambient — things that happened, which nobody has to
                  acknowledge. Notifications wait on a person. Burying the one
                  that waits under the one that doesn't is how a badge ends up
                  counting things nobody ever reaches. */}
              <NeedsYou ctx={ctx} />
              <ActivityFeed hasJobs={jobs.length > 0} />
            </>
          }
          rail={
            <>
              <FormSection
                title="Running now"
                description={productCopy(
                  'pulse.jobs.description',
                  'Work Piggles is doing in the background for you.'
                )}
              >
                <div className={EDITOR_RAIL_STICKY}>
                  {running.length === 0 ? (
                    <EmptyState
                      icon={<Coffee className="size-5" aria-hidden />}
                      title="Nothing running"
                      description="Imports and syncs show up here while they work."
                    />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {running.map((job) => (
                        <li key={job.id}>
                          <JobCard job={job} ctx={ctx} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </FormSection>

              {finished.length > 0 ? (
                <FormSection title="Recent background runs">
                  <ul className="flex flex-col gap-2">
                    {finished.slice(0, FINISHED_SHOWN).map((job) => (
                      <li key={job.id}>
                        <JobCard job={job} ctx={ctx} />
                      </li>
                    ))}
                  </ul>
                  {finished.length > FINISHED_SHOWN ? (
                    // Says what is being withheld rather than trailing off — a
                    // list that silently stops reads as "that's all of them".
                    <Text className="text-sm">
                      The {String(FINISHED_SHOWN)} most recent. Older runs live in the module that
                      started them.
                    </Text>
                  ) : null}
                </FormSection>
              ) : null}
            </>
          }
        />
      </div>
    </div>
  );
}
