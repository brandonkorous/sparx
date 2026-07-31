'use client';

// The shared chrome both onboarding flows render into.
//
// Two parts, kept separate so the flows work in BOTH homes they have:
//   • OnboardingHeader — the wordmark + "Save & exit". The GATE renders this above
//     the flow when onboarding owns the whole viewport at first run. A reopened
//     PANE does not — it already has a pane toolbar — so the header is the gate's,
//     never the flow's.
//   • OnboardingLayout — the two-column body (work pane + the persistent summary).
//     Every flow renders this. It is an @container, so the columns collapse by the
//     width of whatever holds it — the full viewport in the gate, the pane width
//     when reopened — never by the viewport (the workbench's responsive rule).

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Wordmark } from '@sparx/brand/react';
import { signOut } from '@sparx/auth/client';

/** Local class-name join — silicaui-react does not export `cn`, and the workbench
 *  has no shared helper, so this tiny filter keeps the shell dependency-free. */
function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function OnboardingHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="bg-base-100 border-base-300 flex h-14 shrink-0 items-center justify-between border-b px-4 @[48rem]:px-6">
      <Wordmark size={38} aria-label="sparx" />
      <div className="flex items-center gap-4">
        {right}
        <button
          type="button"
          className="text-base-content/70 hover:text-sm"
          onClick={() => {
            // Onboarding persists every step as it goes, so leaving loses nothing —
            // "Save & exit" is an honest label, not a promise we then break.
            void signOut().finally(() => {
              window.location.href = '/sign-in';
            });
          }}
        >
          Save &amp; exit
        </button>
      </div>
    </header>
  );
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
            {step.status === 'done' ? <Check className="text-module size-3.5" aria-hidden /> : null}
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
