'use client';

// The state of choosing ONE entry in a compatibility list: where the drill-down
// stands, the years typed, and a note. Fields are in fitment-chooser.tsx.

import { useState } from 'react';
import { useFitmentNodes, type FitmentDomain, type ProductFitmentRange } from './products-data';
import { rangesFromDrafts, ruleTitle, type RangeDraft } from './fitment-rule-words';

interface Step {
  id: string;
  name: string;
}

/** A rule chosen and not yet written anywhere; `nodePath` names it in toasts. */
export interface ChosenRule {
  domainId: string;
  nodeId: string | null;
  nodePath: string[];
  ranges: ProductFitmentRange[];
  notes: string | null;
}

function hasTyped(drafts: Record<string, RangeDraft>, notes: string): boolean {
  if (notes.trim() !== '') return true;
  return Object.values(drafts).some((d) => d.min.trim() !== '' || d.max.trim() !== '');
}

/** The years and the note: everything about an entry except which entry. */
function useDetails() {
  const [drafts, setDrafts] = useState<Record<string, RangeDraft>>({});
  const [notes, setNotes] = useState('');
  const clearDetails = () => {
    setDrafts({});
    setNotes('');
  };
  return { drafts, setDrafts, notes, setNotes, clearDetails };
}

export function useFitmentChoice(domains: FitmentDomain[], enabled: boolean) {
  const [domainId, setDomainIdState] = useState(domains[0]?.id ?? '');
  const [path, setPath] = useState<Step[]>([]);
  const { drafts, setDrafts, notes, setNotes, clearDetails } = useDetails();

  const domain = domains.find((candidate) => candidate.id === domainId);
  const parentId = path.length > 0 ? (path[path.length - 1]?.id ?? null) : null;
  const nodes = useFitmentNodes(enabled && domainId !== '' ? domainId : null, parentId);
  const dimensions = domain?.dimensions ?? [];
  const rangeDimensions = dimensions.filter((d) => d.kind === 'range');
  const { ranges, problem } = rangesFromDrafts(rangeDimensions, drafts);

  return {
    domainId,
    domain,
    path,
    setPath,
    drafts,
    setDrafts,
    notes,
    setNotes,
    nodes,
    rangeDimensions,
    currentLevel: dimensions.filter((d) => d.kind === 'level')[path.length],
    problem,
    here: ruleTitle({ nodePath: path.map((step) => step.name) }, domain, 'mid'),
    started: path.length > 0 || hasTyped(drafts, notes),
    setDomainId: (next: string) => {
      setDomainIdState(next);
      setPath([]);
      clearDetails();
    },
    build: (): ChosenRule | null =>
      domainId === '' || problem !== null
        ? null
        : {
            domainId,
            nodeId: parentId,
            nodePath: path.map((step) => step.name),
            ranges,
            notes: notes.trim() === '' ? null : notes.trim(),
          },
    reset: () => {
      setPath([]);
      clearDetails();
    },
    /** After choosing one engine, back up to its model so the next is one click. */
    stepUp: () => {
      setPath((current) => current.slice(0, -1));
      clearDetails();
    },
  };
}

export type FitmentChoice = ReturnType<typeof useFitmentChoice>;
