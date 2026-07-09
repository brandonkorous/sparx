'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { Check, FileText, Plus } from 'lucide-react';
import { createLegalPage, addLegalPlacement, acknowledgeLegalPage } from './actions';

export type ChecklistState = 'complete' | 'missing' | 'draft' | 'stale' | 'unplaced';

export interface ChecklistItem {
  legalKind: string;
  title: string;
  defaultSlug: string;
  required: boolean;
  state: ChecklistState;
  entry: {
    id: string;
    slug: string | null;
    status: string;
    updatedAt: string;
    templateVersion: number | null;
    currentVersion: number;
    acknowledged: boolean;
    placed: boolean;
  } | null;
}

export interface ChecklistData {
  items: ChecklistItem[];
  completeness: { requiredTotal: number; requiredComplete: number };
}

const STATE_LABEL: Record<ChecklistState, string> = {
  complete: 'Published',
  missing: 'Not created',
  draft: 'Draft',
  stale: 'Update available',
  unplaced: 'Not in footer',
};

function stateColor(state: ChecklistState): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'complete') return 'success';
  if (state === 'missing') return 'neutral';
  return 'warning';
}

export function LegalChecklist({ data }: { data: ChecklistData }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const { requiredComplete, requiredTotal } = data.completeness;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Policy pages</h3>
        <Badge color={requiredComplete >= requiredTotal ? 'success' : 'warning'} variant="soft">
          {requiredComplete}/{requiredTotal} required published
        </Badge>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <div className="flex flex-col gap-3">
        {data.items.map((item) => (
          <Card key={item.legalKind}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="text-base-content/50 size-4 shrink-0" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    {item.required ? (
                      <Badge color="neutral" variant="soft" size="sm">
                        Required
                      </Badge>
                    ) : null}
                    {item.entry && !item.entry.acknowledged ? (
                      <Badge color="warning" variant="soft">
                        Unreviewed starter text
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-base-content/70 text-xs">
                    /{item.entry?.slug ?? item.defaultSlug}
                    {item.state === 'stale' && item.entry
                      ? ` · template v${item.entry.templateVersion ?? '—'} → v${item.entry.currentVersion} available`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge color={stateColor(item.state)} variant="soft">
                  {item.state === 'complete' ? <Check className="mr-1 size-3" /> : null}
                  {STATE_LABEL[item.state]}
                </Badge>

                {item.entry && !item.entry.acknowledged ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => acknowledgeLegalPage(item.entry!.id))}
                  >
                    <Check className="mr-1 size-3" />
                    Mark reviewed
                  </Button>
                ) : null}

                {item.state === 'missing' ? (
                  <Button
                    color="primary"
                    variant="soft"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => createLegalPage(item.legalKind))}
                  >
                    <Plus className="mr-1 size-3" />
                    Create from template
                  </Button>
                ) : item.state === 'unplaced' && item.entry ? (
                  <>
                    <Button
                      color="primary"
                      variant="soft"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => addLegalPlacement(item.entry!.id))}
                    >
                      Add to footer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/cms/${item.entry!.id}`)}
                    >
                      Edit
                    </Button>
                  </>
                ) : item.entry ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/cms/${item.entry!.id}`)}
                  >
                    {item.state === 'draft' ? 'Edit & publish' : 'Edit'}
                  </Button>
                ) : null}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
