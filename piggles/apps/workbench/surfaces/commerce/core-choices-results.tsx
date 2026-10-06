'use client';

// The two lists below the core charge choices: products to fix by hand first, and
// what the last change did. A changed product leaves the list, so only here does
// one that did NOT change say why.

import { Badge, Button, FieldStatus } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import type { CoreChoiceCandidate, CoreChoiceConversion } from './core-choices-data';
import { changedWords, plural, stuckDetail } from './core-choice-words';

const ROW =
  'border-base-300 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b py-3 first:pt-0 last:border-b-0 last:pb-0';

export function ByHand({
  candidates,
  onOpen,
}: {
  candidates: CoreChoiceCandidate[];
  onOpen: (productId: string) => void;
}) {
  const these = candidates.length === 1 ? 'this one' : `these ${String(candidates.length)}`;
  return (
    <FormSection
      title={`Change ${these} by hand first`}
      description="Each needs a fix on the product before it can change here."
    >
      <ul className="flex flex-col">
        {candidates.map((candidate) => (
          <li key={candidate.productId} className={ROW}>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{candidate.title}</span>
              <FieldStatus status="error">{candidate.problem}</FieldStatus>
            </div>
            <Button
              size="sm"
              color="module"
              variant="outline"
              onClick={() => {
                onOpen(candidate.productId);
              }}
            >
              Open the product
            </Button>
          </li>
        ))}
      </ul>
    </FormSection>
  );
}

function StuckRow({ result, onOpen }: { result: CoreChoiceConversion; onOpen: () => void }) {
  return (
    <li className={ROW}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button type="button" className="link link-hover text-left font-medium" onClick={onOpen}>
          {result.title}
        </button>
        <FieldStatus status="error">{result.problem}</FieldStatus>
      </div>
      <Badge color="error" variant="soft" size="sm">
        Not changed
      </Badge>
    </li>
  );
}

export function Results({
  results,
  onOpen,
  onDone,
}: {
  results: CoreChoiceConversion[];
  onOpen: (productId: string) => void;
  onDone: () => void;
}) {
  const changed = results.filter((result) => result.problem === null).length;
  const stuck = results.filter((result) => result.problem !== null);
  const of = stuck.length === 0 ? '' : `${String(changed)} of `;
  return (
    <FormSection
      title={`Changed ${of}${plural(stuck.length === 0 ? changed : results.length, 'product', 'products')}`}
      description={stuck.length === 0 ? changedWords(changed) : stuckDetail(stuck.length)}
      action={
        <Button size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
      }
    >
      {stuck.length === 0 ? null : (
        <ul className="flex flex-col">
          {stuck.map((result) => (
            <StuckRow
              key={result.productId}
              result={result}
              onOpen={() => {
                onOpen(result.productId);
              }}
            />
          ))}
        </ul>
      )}
    </FormSection>
  );
}
