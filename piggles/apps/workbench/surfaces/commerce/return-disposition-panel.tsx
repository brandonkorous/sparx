'use client';

// WHAT HAPPENS TO THE GOODS — the decision a returns bench actually makes.
//
// Inspection records a JUDGEMENT about condition. Disposition records a DECISION
// about where the units go, and the two are separated here because they are
// separated in the building: somebody opens the box and writes down what they
// find, and somebody — often later, often else — decides whether it goes back on
// the shelf, into quarantine, into the repair queue, or in the skip.
//
// ── Undecided is a state, and it is the work list ─────────────────────────
//
// A line with no disposition renders as an open question, not as a blank. That
// is the whole reason this panel exists: before it, "not restockable" was the
// end of the record and the goods went wherever the person holding them decided.
//
// ── Scrap asks for a reason, and the others do not ────────────────────────
//
// Restock, quarantine and repair all leave something on a shelf that can be
// looked at later. Scrap leaves nothing — no units, no movement, no artefact —
// so the written reason IS the record, and the button will not fire without one.

import { Badge, Button, Input, Text, Timestamp, useToast } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import {
  faBoxCheck,
  faShieldExclamation,
  faTrashCan,
  faWrench,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneEmpty } from '../../components/pane-empty';
import { useState } from 'react';
import { FormSection } from '../../components/form-section';

/** Registry module for this panel, so the brand draws Sell's own picture rather
 *  than the generic one. */
const MODULE = 'commerce';
import { afterCommit } from '../../lib/defer';
import {
  dispositionLabel,
  dispositionTone,
  useReturnDispositions,
  useSetReturnDisposition,
  type ReturnDispositionRow,
} from './returns-data';

const CHOICES = [
  { value: 'restock', label: 'Back on sale', icon: faBoxCheck, color: 'success' as const },
  {
    value: 'quarantine',
    label: 'Quarantine',
    icon: faShieldExclamation,
    color: 'warning' as const,
  },
  { value: 'repair', label: 'Repair', icon: faWrench, color: 'info' as const },
  { value: 'scrap', label: 'Scrap', icon: faTrashCan, color: 'danger' as const },
];

export function ReturnDispositionPanel({ returnId }: { returnId: string }) {
  const toast = useToast();
  const { data, isLoading } = useReturnDispositions(returnId);
  const setDisposition = useSetReturnDisposition(returnId);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const rows = data?.items ?? [];
  const undecided = rows.filter((r) => r.disposition === null);

  const decide = (row: ReturnDispositionRow, disposition: string) => {
    const note = (notes[row.inspectionId] ?? '').trim();
    // The service enforces this too; refusing here means the operator finds out
    // before the round trip rather than after it.
    if (disposition === 'scrap' && note.length === 0) {
      afterCommit(() => {
        toast.add({
          title: 'Say why first',
          description:
            'Scrapping a customer’s returned goods leaves nothing on a shelf to look at later, so the reason is the only record there will be.',
          type: 'warning',
        });
      });
      return;
    }
    setDisposition.mutate(
      { inspectionId: row.inspectionId, disposition, ...(note ? { note } : {}) },
      {
        onSuccess: (result) => {
          setNotes((prev) => ({ ...prev, [row.inspectionId]: '' }));
          afterCommit(() => {
            toast.add({
              title: dispositionLabel(disposition),
              description:
                result.unitsRestocked > 0
                  ? `${result.unitsRestocked} back into stock${disposition === 'restock' ? ' and on sale' : ', on a shelf nothing sells from'}.`
                  : 'Recorded. Nothing went back into stock — the cost stays where it was relieved when the item sold.',
              type: 'success',
            });
          });
        },
        onError: () => {
          afterCommit(() => {
            toast.add({
              title: 'Could not record that',
              description: 'Nothing was changed. Please try again in a moment.',
              type: 'error',
            });
          });
        },
      }
    );
  };

  return (
    <FormSection
      title={
        <>
          What happens to the goods
          {undecided.length > 0 ? (
            <Badge color="warning" variant="soft" size="sm" className="ml-2">
              {undecided.length} to decide
            </Badge>
          ) : null}
        </>
      }
    >
      <div className="p-0">
        {isLoading ? (
          <PaneWaiting label="Loading the inspection…" />
        ) : rows.length === 0 ? (
          /* No extra card: the FormSection above IS one, and nesting a Card
             inside it would double the resting shadow (DESIGN.md §4). The
             wrapper is here for the brand's picture, which the raw EmptyState
             beside a <PaneWaiting> was skipping. */
          <PaneEmpty
            module={MODULE}
            icon={<Icon glyph={faBoxCheck} className="size-6" aria-hidden />}
            title="Nothing inspected yet"
            description="Record an inspection first. Deciding where goods go before anybody has looked at them is how a damaged item ends up back on the shelf."
          />
        ) : (
          <Table size="sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right whitespace-nowrap">Qty</th>
                <th className="whitespace-nowrap">Condition</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.inspectionId}>
                  {/* Wraps rather than truncates. `max-w-0` + `truncate` let the
                      one column that NAMES the goods collapse to "T…" at 360px
                      while Qty and Condition kept their room — on the table
                      whose whole job is deciding about that item. */}
                  <td className="min-w-[7rem]">
                    <span className="flex min-w-0 flex-col">
                      <span className="break-words">
                        {row.variantName ?? row.variantSku ?? 'A free-text line'}
                      </span>
                      {row.dispositionBinCode ? (
                        <span className="text-sm break-words">
                          On shelf {row.dispositionBinCode}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{row.quantity}</td>
                  <td className="text-sm whitespace-nowrap">{row.condition.replace(/_/g, ' ')}</td>
                  <td>
                    {row.disposition ? (
                      <span className="flex flex-col gap-0.5">
                        <Badge color={dispositionTone(row.disposition)} variant="soft" size="sm">
                          {dispositionLabel(row.disposition)}
                        </Badge>
                        {row.dispositionAt ? (
                          <span className="text-sm">
                            <Timestamp value={row.dispositionAt} format="relative" />
                            {row.dispositionNote ? ` · ${row.dispositionNote}` : ''}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="flex flex-col gap-2">
                        <Input
                          size="sm"
                          placeholder="Why (required to scrap)"
                          value={notes[row.inspectionId] ?? ''}
                          onChange={(event) => {
                            const next = event.target.value;
                            setNotes((prev) => ({ ...prev, [row.inspectionId]: next }));
                          }}
                        />
                        <span className="flex flex-wrap gap-1.5">
                          {CHOICES.map((choice) => (
                            <Button
                              key={choice.value}
                              size="xs"
                              color={choice.color}
                              variant="soft"
                              disabled={setDisposition.isPending}
                              onClick={() => {
                                decide(row, choice.value);
                              }}
                            >
                              <Icon glyph={choice.icon} className="size-3.5" aria-hidden />
                              {choice.label}
                            </Button>
                          ))}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      {rows.length > 0 ? (
        <div className="pt-0">
          <Text className="text-sm">
            Quarantined and awaiting-repair goods stay counted as stock you hold and stop being
            sellable — they come off what a customer can buy the moment they land. Scrapped goods
            never re-enter stock at all: their cost was already accounted for when the item sold, so
            adding them back only to write them off would file a customer return under shrinkage.
          </Text>
        </div>
      ) : null}
    </FormSection>
  );
}
