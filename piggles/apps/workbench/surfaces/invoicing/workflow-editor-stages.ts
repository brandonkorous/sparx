'use client';

// The stage list operations the canvas drives: add one, move one, change one,
// take one out — plus which node the inspector is looking at.
//
// Extracted from the editor because they are one job (the list of stages) with
// one piece of state (the selection) and no knowledge of loading, saving or
// archiving.

import { useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { SETTINGS_NODE } from './stage-canvas';
import { blankStage, type StageDraft } from './workflow-data';

export interface StageOps {
  selectedId: string;
  select: (nodeId: string) => void;
  /** Which half a narrow pane is showing, since selecting a node moves to it. */
  pane: 'flow' | 'edit';
  setPane: (next: 'flow' | 'edit') => void;
  insert: (atIndex: number) => void;
  move: (from: number, to: number) => void;
  patch: (key: string, changes: Partial<StageDraft>) => void;
  remove: (key: string) => void;
}

export function useStageOps(
  stages: StageDraft[],
  setStages: (next: StageDraft[]) => void
): StageOps {
  const [selectedId, setSelectedId] = useState<string>(SETTINGS_NODE);
  const [pane, setPane] = useState<'flow' | 'edit'>('flow');

  const select = (nodeId: string) => {
    setSelectedId(nodeId);
    setPane('edit');
  };

  return {
    selectedId,
    select,
    pane,
    setPane,
    insert: (atIndex: number) => {
      const stage = blankStage();
      const clamped = Math.min(Math.max(atIndex, 0), stages.length);
      const next = [...stages];
      next.splice(clamped, 0, stage);
      setStages(next);
      select(stage.key);
    },
    move: (from: number, to: number) => {
      setStages(arrayMove(stages, from, to));
    },
    patch: (key: string, changes: Partial<StageDraft>) => {
      setStages(stages.map((stage) => (stage.key === key ? { ...stage, ...changes } : stage)));
    },
    remove: (key: string) => {
      const index = stages.findIndex((stage) => stage.key === key);
      if (index < 0) return;
      setStages(stages.filter((stage) => stage.key !== key));
      if (selectedId !== key) return;
      const neighbour = stages[index + 1] ?? stages[index - 1];
      setSelectedId(neighbour ? neighbour.key : SETTINGS_NODE);
    },
  };
}
