'use client';

// The edit draft for one campaign: what is on screen, whether it differs from
// what is saved, and the two reasons the server would refuse to turn it on.

import { useEffect, useState } from 'react';
import { ConditionGroup, EMPTY_CONDITION_GROUP } from '@wizeworks/automation-schemas';
import type { Funnel, FunnelStage } from './types';

/**
 * A stored goal, or an empty group.
 *
 * PARSED, not cast. It used to duck-type on the presence of `conditions` and
 * cast, which meant the editor believed any JSON in that column and the server
 * did not: the server parses the same value with this schema and treats a
 * failure as no goal at all. So a campaign whose stored goal was malformed drew
 * a condition row with a raw operator slug in it and offered an enabled "Turn
 * it on" that the server would refuse — the editor showing something the
 * business owner cannot act on and a button that lies.
 *
 * Falling back to the empty group is deliberate rather than lossy: a goal the
 * server cannot read is a goal the campaign does not have, and saying so is
 * what puts the owner in front of the one action that fixes it.
 */
export function asGoal(value: unknown): ConditionGroup {
  const parsed = ConditionGroup.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_CONDITION_GROUP;
}

export interface CampaignDraft {
  name: string;
  description: string;
  stages: FunnelStage[];
  goal: ConditionGroup;
  /** The form somebody fills in to join, or null when nothing feeds it. */
  entryFormNodeId: string | null;
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
  setEntryFormNodeId: (value: string | null) => void;
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
  const [entryFormNodeId, setEntryFormNodeId] = useState<string | null>(null);
  const [stallAfterHours, setStallAfterHours] = useState<number | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const stamp = funnel ? `${funnel.id}:${funnel.updatedAt}` : null;
  useEffect(() => {
    if (!funnel || stamp === loadedFor) return;
    setName(funnel.name);
    setDescription(funnel.description ?? '');
    setStages(funnel.stages);
    setGoal(asGoal(funnel.goal));
    setEntryFormNodeId(funnel.entryFormNodeId);
    setStallAfterHours(funnel.stallAfterHours);
    setLoadedFor(stamp);
  }, [funnel, stamp, loadedFor]);

  const changed =
    funnel !== undefined &&
    (name !== funnel.name ||
      description !== (funnel.description ?? '') ||
      JSON.stringify(stages) !== JSON.stringify(funnel.stages) ||
      JSON.stringify(goal) !== JSON.stringify(asGoal(funnel.goal)) ||
      entryFormNodeId !== funnel.entryFormNodeId ||
      stallAfterHours !== funnel.stallAfterHours);

  const hasGoal = goal.conditions.length > 0;

  return {
    name,
    description,
    stages,
    goal,
    entryFormNodeId,
    stallAfterHours,
    changed,
    hasGoal,
    blockedReason: reasonNotReady(hasGoal, stages, funnel?.entryPageId ?? null),
    setName,
    setDescription,
    setStages,
    setGoal,
    setEntryFormNodeId,
    setStallAfterHours,
  };
}
