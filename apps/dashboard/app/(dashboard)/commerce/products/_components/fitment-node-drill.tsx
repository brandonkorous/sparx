'use client';

// Shared, dimension-driven fitment node drill. Renders one cascading select per
// `level` dimension of a domain; each pick loads the next level's children
// (lazily, via listFitmentNodesAction). Stopping early = a wildcard below
// (attach the rule at that depth). Reports the deepest selected node id (null =
// nothing picked = the whole domain). Reused by the product detail Fitment tab
// and the product-creation wizard. Reset by remounting with `key={domainId}`.

import * as React from 'react';
import { Label, NativeSelect, Stack } from '@sparx/ui';

import type { FitmentDimension, FitmentNodeRow } from '../../fitment-actions';
import { listFitmentNodesAction } from '../../fitment-actions';

interface Props {
  domainId: string;
  /** The domain's `level` dimensions, in order. */
  levels: FitmentDimension[];
  onChange: (nodeId: string | null) => void;
  /** Layout density — the wizard stacks, the detail tab inlines. */
  className?: string;
}

export function FitmentNodeDrill({ domainId, levels, onChange, className }: Props) {
  const [picks, setPicks] = React.useState<string[]>([]);
  const [optionsByDepth, setOptionsByDepth] = React.useState<FitmentNodeRow[][]>([]);

  const loadOptions = React.useCallback(
    async (depth: number, parentId: string | null) => {
      const res = await listFitmentNodesAction(domainId, parentId);
      if (res.ok) {
        setOptionsByDepth((prev) => {
          const next = prev.slice(0, depth);
          next[depth] = res.data;
          return next;
        });
      }
    },
    [domainId]
  );

  React.useEffect(() => {
    setPicks([]);
    setOptionsByDepth([]);
    void loadOptions(0, null);
  }, [loadOptions]);

  function onPick(depth: number, nodeId: string) {
    const nextPicks = picks.slice(0, depth);
    if (nodeId) nextPicks[depth] = nodeId;
    setPicks(nextPicks);
    onChange(nextPicks.length > 0 ? (nextPicks[nextPicks.length - 1] ?? null) : null);
    setOptionsByDepth((prev) => prev.slice(0, depth + 1));
    if (nodeId && depth + 1 < levels.length) {
      void loadOptions(depth + 1, nodeId);
    }
  }

  return (
    <>
      {levels.map((level, depth) => {
        const options = optionsByDepth[depth] ?? [];
        const parentPicked = depth === 0 || Boolean(picks[depth - 1]);
        return (
          <Stack key={level.key} gap={1} className={className ?? 'min-w-[160px] flex-1'}>
            <Label htmlFor={`fit-level-${domainId}-${depth}`}>
              {level.label}
              {depth > 0 ? ' (optional)' : ''}
            </Label>
            <NativeSelect
              id={`fit-level-${domainId}-${depth}`}
              value={picks[depth] ?? ''}
              disabled={!parentPicked || options.length === 0}
              onChange={(e) => onPick(depth, e.target.value)}
            >
              <option value="">
                {depth === 0
                  ? `— Pick a ${level.label.toLowerCase()} —`
                  : `— Any ${level.label.toLowerCase()} —`}
              </option>
              {options.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </NativeSelect>
          </Stack>
        );
      })}
    </>
  );
}
