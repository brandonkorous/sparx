'use client';

// The starting point the gallery marks, the summary names and Continue installs,
// as ONE value, plus what was actually installed. They used to differ: the gallery
// marked the brand default while the summary named the story's match (sparx
// persona issue 008).

import { useMemo, useState } from 'react';
import { industryOf, type StoryState } from '@wizeworks/story-schemas';
import { pickBlueprint } from '../../../lib/onboarding/story-state';
import type { WizardBlueprint } from '../../../lib/onboarding/types';
import { SCRATCH } from './step-blueprint';
import type { Initial } from './wizard-steps';

/** The part of the wizard's opening state this hook reads. */
type StartingInitial = Pick<Initial, 'blueprintKey' | 'templateDone' | 'goldenKey' | 'installId'>;

export function useStartingPoint(
  initial: StartingInitial,
  story: StoryState,
  modules: Record<string, boolean>,
  blueprints: WizardBlueprint[]
) {
  // What the owner explicitly picked (a key or SCRATCH); null until they pick.
  const [choice, setChoice] = useState<string | null>(
    initial.blueprintKey ?? (initial.templateDone ? SCRATCH : null)
  );
  const recommended = useMemo(
    () => pickBlueprint(story.industry ? industryOf(story.industry) : null, modules, blueprints),
    [story.industry, modules, blueprints]
  );
  const selected = choice ?? recommended?.key ?? initial.goldenKey;
  const [installedKey, setInstalledKey] = useState<string | null>(initial.blueprintKey);
  const [installId, setInstallId] = useState<string | null>(initial.installId);
  // What the summary names: the install once there is one, else the selection.
  const startingPoint: WizardBlueprint | null | undefined = installedKey
    ? (blueprints.find((b) => b.key === installedKey) ?? null)
    : selected === SCRATCH
      ? null
      : blueprints.find((b) => b.key === selected);
  return {
    selected,
    setChoice,
    recommendedKey: recommended?.key ?? null,
    installedKey,
    installId,
    startingPoint,
    installed: (key: string | null, id: string | null) => {
      setInstalledKey(key);
      setInstallId(id);
    },
  };
}
