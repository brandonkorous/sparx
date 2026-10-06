'use client';

// The document's frozen history.
//
// Some stages freeze a permanent record on entry — the approved estimate, the
// final invoice — and those records are the point of the whole stage system:
// what the customer agreed to, exactly as it stood, immune to every edit made
// since. This section lists them and opens each one's print view.
//
// A document with no snapshots renders nothing at all. "No history yet" is
// noise on every draft, and the section appearing for the first time when the
// first record freezes is itself informative.

import { useQuery } from '@wizeworks/query';
import { Badge, Button, Tooltip, useToast } from '@wizeworks/silicaui-react';
import { faPrint } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { api } from '../../lib/api/client';
import { openServerHtml } from '../../lib/api/html-artifact';
import { FormSection } from '../../components/form-section';
import { stageTone, type BillingDocument, type DocumentSnapshot } from './types';

function useSnapshots(documentId: string) {
  return useQuery({
    queryKey: ['invoicing', 'snapshots', documentId],
    queryFn: () => api.get<DocumentSnapshot[]>(`/v1/invoicing/documents/${documentId}/snapshots`),
  });
}

export function HistorySection({ doc }: { doc: BillingDocument }) {
  const { data: snapshots } = useSnapshots(doc.id);
  const toast = useToast();

  if (!snapshots || snapshots.length === 0) return null;

  const open = (snapshot: DocumentSnapshot) => {
    openServerHtml(`/v1/invoicing/documents/${doc.id}/snapshots/${snapshot.id}/pdf`).catch(
      (error: unknown) => {
        toast.add({
          title: 'Could not open that record',
          description: error instanceof Error ? error.message : 'Try again in a moment.',
          type: 'error',
        });
      }
    );
  };

  return (
    <FormSection
      title="History"
      description="Permanent records frozen as this document moved through its stages. Each opens exactly as it stood at that moment: later edits never change it."
    >
      {/* A list, not a table. This section lives in the editor's narrow rail,
          where a When / Frozen at / Number table scrolled sideways to reach its
          own print button (sparx persona issue 085). Each record reads as one
          line of who-and-when with the button beside it. */}
      <ul className="flex flex-col gap-2">
        {snapshots.map((snapshot) => (
          <li key={snapshot.id} className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              {/* The label AS CAPTURED, not the stage's current name — a
                  renamed stage must never rewrite what this record was. */}
              <span>
                <Badge color={stageTone(snapshot.stageType)} variant="soft" size="sm">
                  {snapshot.customerLabel}
                </Badge>
              </span>
              <span className="text-sm">
                {new Date(snapshot.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {snapshot.documentNumber ? ` · ${snapshot.documentNumber}` : ''}
              </span>
            </div>
            <Tooltip content="Open this record's print view">
              <Button
                variant="ghost"
                size="xs"
                shape="square"
                aria-label={`Print the record frozen at ${snapshot.customerLabel}`}
                onClick={() => {
                  open(snapshot);
                }}
              >
                <Icon glyph={faPrint} className="size-4" aria-hidden />
              </Button>
            </Tooltip>
          </li>
        ))}
      </ul>
    </FormSection>
  );
}
