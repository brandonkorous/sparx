'use client';

// Background work in flight, and how far along it is.
// Lifted out of components/status-bar.tsx, which had grown past the 250-line
// ceiling (piggles/CLAUDE.md RULE #0.5). The strip itself is now just the strip.

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  Progress,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { faSpinner } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useWorkbench } from '../../lib/workbench/context';
import type { Job } from '../../lib/api/jobs';

/**
 * The running-jobs chip: what background work is in flight, and how far along.
 *
 * A popover, not a menu — the rows are read-only status, not actions. The
 * trigger names the single job when there's one (the common case: one import)
 * and falls back to a count. A spinner rather than a static icon because the
 * entire message of this chip is "something is still working." Opens UPWARD
 * (side="top") — it lives on the bottom edge, a downward panel would clip.
 *
 * Every job here is `running` by construction: the endpoint's active set is
 * pending/processing only, so a failure drops OUT of this list rather than
 * turning a row red. Surfacing failures with an explanation is the notification
 * layer's job (docs/124 Phase 3), not the chip's.
 */
export function JobsChip({ jobs }: { jobs: Job[] }) {
  const { controller } = useWorkbench();
  const trigger =
    jobs.length === 1 ? (jobs[0]?.label ?? 'Working…') : `${String(jobs.length)} running`;

  return (
    <Popover>
      <Tooltip content="Background work in progress">
        <PopoverTrigger>
          <Button variant="ghost" size="xs" className="gap-1.5">
            <Icon glyph={faSpinner} className="size-3.5 animate-spin" aria-hidden />
            <span className="max-w-56 truncate">{trigger}</span>
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="top" align="end" className="w-72">
        <PopoverTitle>Running now</PopoverTitle>
        <ul className="mt-2 flex flex-col gap-3">
          {jobs.map((job) => {
            // Capture into a const so the closure narrows it to string — an
            // inline `job.surface` wouldn't, since a field could change.
            const surface = job.surface;
            return (
              <li key={job.id}>
                <JobRow job={job} onOpen={surface ? () => controller.open(surface) : undefined} />
              </li>
            );
          })}
        </ul>
        {/* The chip only ever shows what's STILL going — a job that finishes or
            fails drops out of it silently. Pulse is where that gets answered,
            so the way there belongs right here. */}
        <div className="border-base-300 mt-3 border-t pt-2">
          <Button
            variant="ghost"
            size="xs"
            className="w-full justify-start"
            onClick={() => {
              controller.open('platform.pulse');
            }}
          >
            Open Pulse
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** One running job: label, percentage, progress bar. Becomes a button that
 *  opens the surface its output lands in when the job HAS one — a plain block
 *  otherwise, so a job with nowhere to go isn't a dead-looking control. */
function JobRow({ job, onOpen }: { job: Job; onOpen?: () => void }) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate">{job.label}</span>
        {job.progress !== null ? (
          <span className="tabular-nums">{String(job.progress)}%</span>
        ) : null}
      </span>
      {/* Null progress → indeterminate bar (pending, not yet counting). */}
      <Progress color="primary" size="xs" value={job.progress ?? undefined} />
    </>
  );

  if (!onOpen) return <div className="flex flex-col gap-1">{body}</div>;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="hover:bg-base-200 -mx-1 flex w-[calc(100%+0.5rem)] flex-col gap-1 rounded px-1 py-0.5 text-left"
    >
      {body}
    </button>
  );
}
