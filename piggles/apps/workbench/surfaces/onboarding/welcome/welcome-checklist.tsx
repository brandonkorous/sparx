'use client';

// The welcome checklist — the day-0+ "get production-ready" surface a tenant lands
// on once setup is finished.
//
// Distinct from the two setup FLOWS: those get a business live; this nudges the
// handful of things worth doing next (add a page, connect a domain, turn on
// payments). It reads DERIVED progress from api-rest — each step's done-ness comes
// from real domain data, not a flag — so it never claims something is done that
// isn't, and never re-nags something the tenant already did through another door.
//
// A landing surface, like "Start here": it renders plain (no pane toolbar), scrolls
// inside its own container, and every CTA is a surface to OPEN, never an href —
// the workbench has no routes.

import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Button, Heading, Progress, Text, cx } from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { useOnboardingProgress } from '../../../lib/onboarding/api';
import type { OnboardingStep } from '../../../lib/onboarding/types';

export function WelcomeSurface({ ctx }: { ctx: SurfaceContext }) {
  const { data: progress, isLoading, isError } = useOnboardingProgress();

  return (
    <div className="@container h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10 @[40rem]:px-8 @[40rem]:py-12">
        <div>
          <Heading level={1} className="text-2xl">
            You&rsquo;re set up. Here&rsquo;s what&rsquo;s next.
          </Heading>
          <Text className="mt-2">
            Your business is live. These are the few things worth doing next — do them in any order,
            or come back whenever you&rsquo;re ready.
          </Text>
        </div>

        {isLoading ? (
          <Text>Loading your progress…</Text>
        ) : isError || !progress ? (
          <Text className="text-error">
            We couldn&rsquo;t load your checklist. Try again shortly.
          </Text>
        ) : (
          <>
            <ProgressMeter completion={progress.completion} steps={progress.steps} />
            <ol className="flex flex-col gap-3">
              {progress.steps.map((step) => (
                <ChecklistItem key={step.id} step={step} ctx={ctx} />
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

function ProgressMeter({ completion, steps }: { completion: number; steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round(completion * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">
          {done} of {steps.length} done
        </span>
        <span className="text-sm tabular-nums">{pct}%</span>
      </div>
      <Progress value={done} max={steps.length} color="module" />
    </div>
  );
}

function ChecklistItem({ step, ctx }: { step: OnboardingStep; ctx: SurfaceContext }) {
  return (
    <li
      className={cx(
        'border-base-300 flex items-start gap-4 rounded-xl border p-4',
        step.done ? 'bg-base-200' : 'bg-base-100'
      )}
    >
      <span
        className={cx(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
          step.done ? 'bg-module text-module-content' : 'border-base-300 border'
        )}
        aria-hidden
      >
        {step.done ? <Icon glyph={faCheck} className="size-3.5" /> : null}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cx('font-medium', step.done && '')}>{step.title}</p>
        <Text className="text-sm">{step.description}</Text>
      </div>
      {!step.done && step.cta ? (
        step.comingSoon ? (
          <Text className="mt-1 shrink-0 text-sm">Coming soon</Text>
        ) : (
          <Button
            size="sm"
            color="module"
            variant="soft"
            className="shrink-0"
            onClick={() => {
              ctx.open(step.cta!.surface, step.cta!.params);
            }}
          >
            {step.cta.label}
          </Button>
        )
      ) : null}
    </li>
  );
}
