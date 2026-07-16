'use client';

// The workflow stage bar (docs/87 §3) — the document's lifecycle as a row of
// stages with the current one highlighted. Clicking another stage advances the
// document there; the confirm spells out the entry effects (number / snapshot /
// lock) so a finalize is never a surprise.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import { useConfirm } from '@sparx/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { advanceStageAction } from '../../../document-actions';

interface StageLite {
  id: string;
  name: string;
  customerLabel: string;
  snapshotOnEnter: boolean;
  numberOnEnter: boolean;
  locksEditing: boolean;
}

interface StageBarProps {
  documentId: string;
  stages: StageLite[];
  currentStageId: string;
}

export function StageBar({ documentId, stages, currentStageId }: StageBarProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const currentIdx = stages.findIndex((s) => s.id === currentStageId);

  async function advance(stage: StageLite) {
    const effects: string[] = [];
    if (stage.numberOnEnter) effects.push('assign its number');
    if (stage.snapshotOnEnter) effects.push('freeze a permanent record');
    if (stage.locksEditing) effects.push('lock the line items from further edits');

    const ok = await confirm({
      title: `Move to "${stage.customerLabel}"?`,
      description: effects.length
        ? `Entering this stage will ${joinClauses(effects)}.`
        : 'The document moves to this stage.',
      tone: 'module',
      confirmLabel: 'Advance',
    });
    if (!ok) return;

    startTransition(async () => {
      setError(null);
      const res = await advanceStageAction(documentId, stage.id);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody className="py-4">
        <div className="flex flex-wrap items-center gap-2">
          {stages.map((stage, idx) => {
            const isCurrent = stage.id === currentStageId;
            const isPast = idx < currentIdx;
            return (
              <React.Fragment key={stage.id}>
                {idx > 0 && (
                  <span aria-hidden className="text-base-content">
                    ›
                  </span>
                )}
                {isCurrent ? (
                  <Badge color="module" variant="solid" size="md">
                    {stage.customerLabel}
                  </Badge>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void advance(stage)}
                    className="border-base-300 text-base-content hover:border-module hover:text-module inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50"
                  >
                    {isPast && <Check className="h-3.5 w-3.5" />}
                    {stage.customerLabel}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
        {error && (
          <p className="text-danger mt-3 text-sm" role="alert">
            {error}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function joinClauses(items: string[]): string {
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
