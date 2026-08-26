'use client';

// The edit draft for one campaign: what is on screen, whether it differs from
// what is saved, and the two reasons the server would refuse to turn it on.

import { useEffect, useState } from 'react';
import { EMPTY_CONDITION_GROUP, type ConditionGroup } from '@wizeworks/automation-schemas';
import type { Funnel, FunnelStage } from './types';

/** A stored goal, or an empty group. The column is JSON, so a campaign written
 *  before a shape change must not take the editor down with it. */
export function asGoal(value: unknown): ConditionGroup {
  if (value && typeof value === 'object' && 'conditions' in value) return value as ConditionGroup;
  return EMPTY_CONDITION_GROUP;
}

export interface CampaignDraft {
  name: string;
  description: string;
  stages: FunnelStage[];
  goal: ConditionGroup;
  /** This campaign's own patience, or null to follow its kind's default. */
  stallAfterHours: number | null;
  changed: boolean;
  /** Why this campaign cannot be turned on yet, in words, or null when it can. */
  blockedReason: string | null;
  hasGoal: boolean;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  setStages: (value: FunnelStage[]) => void;
  setGoal: (value: ConditionGroup) => void;
  setStallAfterHours: (value: number | null) => void;
}

/** The two things the server insists on before a campaign may run, said before
 *  the click rather than as a 400 after it. */
function reasonNotReady(
  hasGoal: boolean,
  stages: FunnelStage[],
  entryPageId: string | null
): string | null {
  if (!hasGoal) {
    return 'Say what has to happen for this campaign to have worked, below, before you turn it on.';
  }
  const uncountable = stages.filter((s) => s.kind === 'view' && !s.path && !entryPageId);
  if (uncountable.length === 0) return null;
  const names = uncountable.map((s) => `"${s.name}"`).join(' and ');
  return `Say which page counts as ${names} before you turn it on.`;
}

/**
 * Seeded once per saved version of the campaign.
 *
 * Keyed on `updatedAt` rather than on mount, so a refetch after a save re-syncs
 * while typing is never interrupted by a background refresh.
 */
export function useCampaignDraft(funnel: Funnel | undefined): CampaignDraft {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [goal, setGoal] = useState<ConditionGroup>(EMPTY_CONDITION_GROUP);
  const [stallAfterHours, setStallAfterHours] = useState<number | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const stamp = funnel ? `${funnel.id}:${funnel.updatedAt}` : null;
  useEffect(() => {
    if (!funnel || stamp === loadedFor) return;
    setName(funnel.name);
    setDescription(funnel.description ?? '');
    setStages(funnel.stages);
    setGoal(asGoal(funnel.goal));
    setStallAfterHours(funnel.stallAfterHours);
    setLoadedFor(stamp);
  }, [funnel, stamp, loadedFor]);

  const changed =
    funnel !== undefined &&
    (name !== funnel.name ||
      description !== (funnel.description ?? '') ||
      JSON.stringify(stages) !== JSON.stringify(funnel.stages) ||
      JSON.stringify(goal) !== JSON.stringify(asGoal(funnel.goal)) ||
      stallAfterHours !== funnel.stallAfterHours);

  const hasGoal = goal.conditions.length > 0;

  return {
    name,
    description,
    stages,
    goal,
    stallAfterHours,
    changed,
    hasGoal,
    blockedReason: reasonNotReady(hasGoal, stages, funnel?.entryPageId ?? null),
    setName,
    setDescription,
    setStages,
    setGoal,
    setStallAfterHours,
  };
}
