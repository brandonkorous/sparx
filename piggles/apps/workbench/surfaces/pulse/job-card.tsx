'use client';

// One background run, as a row in the jobs rail.

import { faCircleCheck, faCircleExclamation, faSpinner } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Badge, Progress, Text } from '@wizeworks/silicaui-react';
import { describeAgo } from '../../lib/api/activity';
import type { Job, JobStatus } from '../../lib/api/jobs';
import type { SurfaceContext } from '../../lib/surfaces/registry';

/** State is its own colour axis, independent of the module hue — see
 *  docs/23 Semantic-Status and the invoicing statusTone it mirrors. */
function jobTone(status: JobStatus): 'success' | 'danger' | 'info' {
  if (status === 'done') return 'success';
  if (status === 'failed') return 'danger';
  return 'info';
}

function jobStatusLabel(status: JobStatus): string {
  if (status === 'done') return 'Finished';
  if (status === 'failed') return 'Failed';
  return 'Running';
}

/**
 * One run. Clickable when we know which surface its output lands in, so a
 * finished product import is one click from the products it created; inert
 * otherwise rather than a button that goes nowhere.
 */
export function JobCard({ job, ctx }: { job: Job; ctx: SurfaceContext }) {
  const surface = job.surface;
  const when = job.finishedAt ?? job.startedAt;

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {job.status === 'running' ? (
            <Icon
              glyph={faSpinner}
              className="text-info size-4 shrink-0 animate-spin"
              aria-hidden
            />
          ) : job.status === 'failed' ? (
            <Icon glyph={faCircleExclamation} className="text-danger size-4 shrink-0" aria-hidden />
          ) : (
            <Icon glyph={faCircleCheck} className="text-success size-4 shrink-0" aria-hidden />
          )}
          <span className="truncate font-medium">{job.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {job.status === 'running' && job.progress !== null ? (
            <span className="tabular-nums">{String(job.progress)}%</span>
          ) : (
            <Text className="text-sm">{describeAgo(when)}</Text>
          )}
          <Badge color={jobTone(job.status)} variant="soft" size="sm">
            {jobStatusLabel(job.status)}
          </Badge>
        </span>
      </div>

      {job.status === 'running' ? (
        // Null progress → indeterminate bar (queued, not yet counting rows).
        <Progress className="mt-2" color="primary" size="xs" value={job.progress ?? undefined} />
      ) : null}

      {/* Full size, not a caption: an explanation of why work failed is the
          one thing on this card someone genuinely needs to read. */}
      {job.error ? <Text className="text-danger mt-1">{job.error}</Text> : null}
    </>
  );

  if (!surface) {
    return <div className="border-base-300 rounded-lg border px-4 py-3">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        ctx.open(surface);
      }}
      className="border-base-300 hover:bg-base-200 block w-full rounded-lg border px-4 py-3 text-left"
    >
      {body}
    </button>
  );
}
