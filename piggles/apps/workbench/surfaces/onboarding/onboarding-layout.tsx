'use client';

// The two-column body both onboarding flows render into.
//
// Every flow renders this. It is an @container, so the columns collapse by the
// width of whatever holds it — the pane width — never by the viewport (the
// workbench's responsive rule).
//
// There is deliberately NO header here. Signup-time onboarding belongs to
// getpiggles.com (piggles/CLAUDE.md, "The three surfaces"), so the console never
// owns the whole viewport for it and never needs a wordmark bar above it. These
// flows exist in the console only as REOPENABLE panes — resume a story, redo a
// step — and a pane already has a toolbar.

import type { ReactNode } from 'react';
import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

/** Local class-name join — silicaui-react does not export `cn`, and the workbench
 *  has no shared helper, so this tiny filter keeps the shell dependency-free. */
function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export interface StepMark {
  key: string;
  label: string;
  status: 'done' | 'current' | 'upcoming';
}

/** The step indicators above the work pane. A quiet row — scale and weight carry
 *  which one is live, not an eyebrow or a numbered chip. */
export function StepRail({ steps }: { steps: StepMark[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {steps.map((step, i) => (
        <li key={step.key} className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 text-sm',
              step.status === 'current' && 'font-medium',
              step.status === 'done' && 'text-base-content/70',
              step.status === 'upcoming' && 'text-base-content/40'
            )}
          >
            {step.status === 'done' ? (
              <Icon glyph={faCheck} className="text-module size-3.5" aria-hidden />
            ) : null}
            {step.label}
          </span>
          {i < steps.length - 1 ? (
            <span className="text-base-content/25" aria-hidden>
              /
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export interface OnboardingLayoutProps {
  /** The left column — the current step body or the compose stage. */
  work: ReactNode;
  /** The right column — the persistent SummaryCard. */
  summary: ReactNode;
  /** Optional step indicators shown above the work pane. */
  steps?: StepMark[];
  /** Optional heading + supporting line above the work pane. */
  heading?: ReactNode;
  /** Optional second card stacked under the work panel in the left column (the story
   *  flow's how-to legend). Its own surface, so it reads as a distinct card. */
  belowWork?: ReactNode;
}

export function OnboardingLayout({
  work,
  summary,
  steps,
  heading,
  belowWork,
}: OnboardingLayoutProps) {
  return (
    <div className="@container min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 @[48rem]:px-6 @[64rem]:gap-8 @[64rem]:py-10">
        {/* The step rail spans the full width above BOTH columns, a quiet breadcrumb
            on the canvas — so the work panel and the summary card start at the same
            top edge and align, rather than the rail pushing only the left column down. */}
        {steps && steps.length > 0 ? <StepRail steps={steps} /> : null}
        <div className="grid gap-6 @[64rem]:grid-cols-[minmax(0,1fr)_22rem] @[64rem]:gap-8">
          {/* Left column: the work panel, with an optional helper card stacked beneath. */}
          <div className="flex min-w-0 flex-col gap-6">
            {/* The work panel — a base-100 surface lifted on the recessed canvas, the
                twin of the summary card beside it (edge + colour, never a shadow). */}
            <div className="bg-base-100 border-base-300 flex flex-col gap-6 rounded-xl border p-6 @[48rem]:p-8">
              {heading}
              {work}
            </div>
            {belowWork}
          </div>
          {/* The summary sits below the work pane when the container is narrow, and
              sticks alongside it once there is room for two columns. */}
          <div className="@[64rem]:sticky @[64rem]:top-10 @[64rem]:self-start">{summary}</div>
        </div>
      </div>
    </div>
  );
}
