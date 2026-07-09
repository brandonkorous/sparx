'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { ArrowRight, Check, Circle } from 'lucide-react';
import { dismissOnboarding } from './actions';
import type { OnboardingProgress } from './onboarding';

export interface WelcomeChecklistProps {
  progress: OnboardingProgress;
}

export function WelcomeChecklist({ progress }: WelcomeChecklistProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const completionPct = Math.round(progress.completion * 100);

  function onSkip() {
    startTransition(async () => {
      await dismissOnboarding();
      router.push('/');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <div className="flex flex-row items-center justify-between gap-4">
            <h3 className="text-xl font-semibold">Setup progress</h3>
            <p className="text-base-content/70 text-sm">{completionPct}% complete</p>
          </div>
          <ProgressBar value={progress.completion} />
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        {progress.steps.map((step) => (
          <Card key={step.id}>
            <CardBody>
              <div className="flex flex-row items-start gap-3">
                <span
                  aria-hidden
                  // eslint-disable-next-line no-restricted-syntax -- step indicator icon container, not a reimplemented control
                  className="bg-base-200 text-base-content/70 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                >
                  {step.done ? (
                    <Check className="text-success h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-row items-center gap-2">
                    <p className="font-medium">{step.title}</p>
                    {step.comingSoon && (
                      <Badge color="neutral" variant="soft" size="sm">
                        Coming soon
                      </Badge>
                    )}
                    {step.done && !step.comingSoon && (
                      <Badge color="success" variant="soft" size="sm">
                        Done
                      </Badge>
                    )}
                  </div>
                  <p className="text-base-content/70 text-sm">{step.description}</p>
                </div>
                {step.cta && !step.done && (
                  <Button
                    render={<Link href={step.cta.href} />}
                    variant="ghost"
                    size="sm"
                    iconEnd={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    {step.cta.label}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-row items-center justify-between gap-4">
        <p className="text-base-content/70 text-sm">
          You can finish the rest from the dashboard anytime.
        </p>
        <div className="flex flex-row gap-2">
          <Button variant="ghost" onClick={onSkip} disabled={pending}>
            Skip for now
          </Button>
          <Button render={<Link href="/" />}>Go to dashboard</Button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-base-200 h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className="bg-primary h-full transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
