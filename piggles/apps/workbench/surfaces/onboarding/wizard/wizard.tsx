'use client';

// The classic wizard's entry point: load what setup already knows, then hand it
// to the brain (wizard-inner) as ONE resolved starting state.

import { Loading, Text } from '@wizeworks/silicaui-react';

import { useBlueprints, useOnboarding } from '../../../lib/onboarding/api';

import { useSites, useTenant } from '../../../lib/api/shell-data';
import { storyFromPersisted } from '../../../lib/onboarding/story-state';

import type { Initial } from './wizard-steps';
import { WizardInner } from './wizard-inner';

export function ClassicWizard({
  onSwitchToStory,
  onFinished,
}: {
  onSwitchToStory: () => void;
  onFinished: () => void;
}) {
  const onboarding = useOnboarding();
  const tenantQ = useTenant();
  const sitesQ = useSites();
  const blueprintsQ = useBlueprints();

  const loadError =
    onboarding.error || tenantQ.error || sitesQ.error
      ? 'We could not load your setup. Refresh to try again.'
      : null;

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Text>{loadError}</Text>
      </div>
    );
  }

  if (!onboarding.data || !tenantQ.data || !sitesQ.data) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loading size="lg" />
      </div>
    );
  }

  const state = onboarding.data;
  const primarySite = sitesQ.data.find((s) => s.isPrimary) ?? sitesQ.data[0];

  const initial: Initial = {
    step: state.currentStep ?? 'modules',
    blueprintKey: state.blueprintKey ?? null,
    goldenKey: state.goldenKey ?? null,
    installId: state.installId ?? null,
    // Seeding is on purpose, so the examples come unless she has said otherwise.
    sampleData: state.sampleData ?? true,
    templateDone: Boolean(state.completed?.template),
    paymentsDone: Boolean(state.completed?.payments),
    companyName: tenantQ.data.name ?? '',
    slug: tenantQ.data.slug ?? '',
    siteName: primarySite?.name ?? '',
  };

  return (
    <WizardInner
      initial={initial}
      initialStory={state.story ? storyFromPersisted(state.story) : null}
      blueprints={blueprintsQ.data ?? []}
      blueprintsLoading={blueprintsQ.isLoading}
      onSwitchToStory={onSwitchToStory}
      onFinished={onFinished}
    />
  );
}
