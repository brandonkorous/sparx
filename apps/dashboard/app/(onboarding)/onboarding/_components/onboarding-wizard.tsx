'use client';

import * as React from 'react';
import { Card, Heading, Stack, Stepper, Text } from '@sparx/ui';
import { goToStepAction } from '../_lib/actions';
import type { OnboardingStepKey, WizardInitialState } from '../_lib/types';
import { StepTemplate } from './step-template';
import { StepDomain } from './step-domain';
import { StepPayments } from './step-payments';
import { StepLaunch } from './step-launch';

// Step order is the single source for "next"/"back" math and the Stepper index.
// `template` and `launch` are full-bleed (the gallery + the preview own the whole
// stage); `domain` and `payments` are centered form steps inside the stepper card.
const ORDER: OnboardingStepKey[] = ['template', 'domain', 'payments', 'launch'];

const STEPPER_STEPS = [
  { label: 'Template', description: 'Pick a starting point' },
  { label: 'Domain', description: 'Your address' },
  { label: 'Payments', description: 'Get paid' },
  { label: 'Launch', description: 'Go live' },
];

/** Each step receives a uniform navigation contract. */
export interface StepNav {
  /** Advance to the next step (client-only — the completing action already
   *  persisted `currentStep`). */
  onNext: () => void;
  /** Skip this step without completing it (persists + advances). */
  onSkip: () => void;
  /** Go back one step (persists + advances). */
  onBack: () => void;
  /** True while a persist-and-navigate transition is in flight. */
  navPending: boolean;
}

export function OnboardingWizard({ initial }: { initial: WizardInitialState }) {
  const [step, setStep] = React.useState<OnboardingStepKey>(initial.step);
  const [navPending, startNav] = React.useTransition();

  const idx = Math.max(0, ORDER.indexOf(step));
  const prevStep = ORDER[Math.max(idx - 1, 0)] ?? 'template';

  const goClient = React.useCallback((target: OnboardingStepKey) => setStep(target), []);

  // Persist `currentStep` then move — used by Skip/Back where no step action ran.
  const goPersist = React.useCallback(
    (target: OnboardingStepKey) => {
      startNav(async () => {
        await goToStepAction(target);
        setStep(target);
      });
    },
    [startNav]
  );

  const nav = (target: OnboardingStepKey): StepNav => ({
    onNext: () => goClient(target),
    onSkip: () => goPersist(target),
    onBack: () => goPersist(prevStep),
    navPending,
  });

  // Full-bleed steps own the whole stage and render no stepper chrome.
  if (step === 'template') {
    return (
      <StepTemplate
        blueprints={initial.blueprints}
        preselectKey={initial.preselectKey}
        nav={nav('domain')}
      />
    );
  }
  if (step === 'launch') {
    return (
      <StepLaunch
        slug={initial.slug}
        installId={initial.installId}
        onDifferentTemplate={() => goPersist('template')}
      />
    );
  }

  // Centered form steps (Domain, Payments) sit in the narrow card with the stepper.
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Stack gap={8}>
        <Stack gap={2}>
          <Heading level={1}>Set up your site</Heading>
          <Text variant="muted">
            A couple of quick steps, then you&apos;re live. Everything here can be changed later.
          </Text>
        </Stack>

        <Stepper steps={STEPPER_STEPS} current={idx} />

        <Card padding="lg">
          {step === 'domain' && <StepDomain initialSlug={initial.slug} nav={nav('payments')} />}
          {step === 'payments' && <StepPayments nav={nav('launch')} />}
        </Card>
      </Stack>
    </div>
  );
}
