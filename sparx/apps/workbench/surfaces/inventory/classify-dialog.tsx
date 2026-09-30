'use client';

// ANSWERING A RANKING BY HAND.
//
// The rule, the measurement and the reasoning live in `classify-by-hand.ts`;
// this is the door onto them. What it shows, in order:
//
//   1. What the numbers worked out, and for an unpriced line, why they could
//      not. Shown FIRST and always, including after an answer has been given:
//      an override that hides the measurement it replaced is a number with no
//      second opinion, which is the failure "Why this number" exists to stop.
//   2. Two pickers, each with an explicit "Work it out from my numbers" option
//      rather than a blank. A blank first option reads as "not loaded yet".
//   3. A reason. Optional, because insisting on one is how a screen gets
//      answered with "because", and it is the part somebody reads a year later.
//
// Not a pane. This is one short question about one row of a list, it is opened
// from that row, and it is finished in a few seconds. The pane it would compete
// with is already spoken for: clicking the row itself opens "Why this number",
// which is the long answer to the neighbouring question.
//
// Byte-identical in both consoles: it renders no icon, so there is nothing in it
// that has to come from one brand's icon set or the other's.

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  NativeSelect,
  Text,
  Textarea,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useConfirm } from '../../lib/confirm';
import { afterCommit } from '../../lib/defer';
import { stockErrorMessage } from './data';
import {
  abcLabel,
  abcTone,
  useSetClassification,
  xyzLabel,
  xyzTone,
  type ClassificationRow,
} from './planning-data';
import {
  classifyMoved,
  classifyWrite,
  hasAnswer,
  LEAVE_IT,
  REASON_DESCRIPTION,
  type AbcChoice,
  type ClassifyForm,
  type XyzChoice,
} from './classify-by-hand';

interface Props {
  open: boolean;
  onClose: () => void;
  row: ClassificationRow | null;
}

const EMPTY: ClassifyForm = { abc: '', xyz: '', reason: '' };

export function ClassifyDialog({ open, onClose, row }: Props) {
  const [form, setForm] = useState<ClassifyForm>(EMPTY);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const save = useSetClassification();
  const confirm = useConfirm();
  const toast = useToast();

  const key = row ? `${row.variantId}:${row.warehouseId}` : null;

  // Seeded from what is stored, keyed on the ROW rather than on the object, so
  // a background refetch of the list behind the dialog cannot wipe what is
  // being typed into it.
  useEffect(() => {
    if (!open || !row || seededFor === key) return;
    setForm({
      abc: row.abcOverride ?? '',
      xyz: row.xyzOverride ?? '',
      reason: row.overrideReason ?? '',
    });
    setSeededFor(key);
  }, [open, row, key, seededFor]);

  if (!row) return null;

  const stored = {
    abcOverride: row.abcOverride,
    xyzOverride: row.xyzOverride,
    overrideReason: row.overrideReason,
  };
  const moved = classifyMoved(form, stored);
  const what = row.sku ?? row.title ?? 'this item';

  const requestClose = async () => {
    if (moved) {
      const ok = await confirm({
        title: 'Leave this without saving?',
        description: `Nothing has been saved, so ${what} keeps the ranking it has now.`,
        confirmLabel: 'Leave it',
        cancelLabel: 'Keep editing',
        color: 'danger',
      });
      if (!ok) return;
    }
    setSeededFor(null);
    onClose();
  };

  const write = (next: ClassifyForm, said: string) => {
    save.mutate(
      {
        variantId: row.variantId,
        warehouseId: row.warehouseId,
        ...classifyWrite(next),
      },
      {
        onSuccess: () => {
          setSeededFor(null);
          onClose();
          afterCommit(() => {
            toast.add({ title: said, type: 'success' });
          });
        },
        onError: (error: unknown) => {
          afterCommit(() => {
            toast.add({
              title: 'Could not change how this is ranked',
              description: stockErrorMessage(error, 'Nothing was changed.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) void requestClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
          <DialogTitle>Where {what} sits in your stock</DialogTitle>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            <Text className="text-sm">
              Ranking works from what you use in a year and what a unit cost you. Some things it
              cannot see: what a line you make yourself cost to make, which one your shop is known
              for, which one is about to be in the window. Tell it here and your answer stands.
            </Text>

            {/* The measurement stays visible after an answer is given. An
                override that hides what it replaced leaves a number with
                nothing to check it against. */}
            <div className="border-base-300 flex flex-col gap-2 rounded-lg border p-3">
              <Text className="text-sm font-semibold">What your numbers worked out</Text>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={abcTone(row.costKnown ? row.measuredAbcClass : null)} variant="soft">
                  {row.costKnown ? abcLabel(row.measuredAbcClass) : 'No cost price'}
                </Badge>
                <Badge color={xyzTone(row.measuredXyzClass)} variant="soft">
                  {xyzLabel(row.measuredXyzClass)}
                </Badge>
              </div>
              {!row.costKnown ? (
                <Text className="text-sm">
                  Nothing is recorded for what a unit of this cost you, so a year of it works out to
                  nothing and it lands at the bottom whatever it is really worth. Recording the cost
                  is the fuller answer. Saying so here is the one to reach for when there will never
                  be a purchase cost, because you make it.
                </Text>
              ) : null}
            </div>

            <Field>
              <FieldLabel>Worth</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    color="module"
                    value={form.abc}
                    onChange={(event) => {
                      setForm({ ...form, abc: event.target.value as AbcChoice });
                    }}
                  >
                    <option value="">{LEAVE_IT}</option>
                    <option value="A">Top value</option>
                    <option value="B">Mid value</option>
                    <option value="C">Long tail</option>
                  </NativeSelect>
                }
              />
              <FieldDescription>
                Where buying attention pays. Top value earns a tight reorder level and a regular
                count; long tail earns buying when somebody asks.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Demand</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    color="module"
                    value={form.xyz}
                    onChange={(event) => {
                      setForm({ ...form, xyz: event.target.value as XyzChoice });
                    }}
                  >
                    <option value="">{LEAVE_IT}</option>
                    <option value="X">Steady</option>
                    <option value="Y">Uneven</option>
                    <option value="Z">Erratic</option>
                  </NativeSelect>
                }
              />
              <FieldDescription>
                Whether it sells at a rate worth forecasting. This one needs about six separate
                selling days over at least four weeks before the numbers will say anything at all.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Why</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    maxLength={500}
                    placeholder="We make this one, so it never has a purchase cost."
                    value={form.reason}
                    onChange={(event) => {
                      setForm({ ...form, reason: event.target.value });
                    }}
                  />
                }
              />
              <FieldDescription>{REASON_DESCRIPTION}</FieldDescription>
            </Field>

            {hasAnswer(stored) && row.overrideAt ? (
              <Text className="text-sm">
                Answered by hand <Timestamp value={row.overrideAt} format="relative" />.
              </Text>
            ) : null}
          </div>

          <DialogFooter>
            {/* Hidden rather than disabled when there is nothing to put back: a
                greyed control invites somebody to work out what would turn it
                on, and the answer here is "having already used this dialog". */}
            {hasAnswer(stored) ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  write(EMPTY, `${what} goes back to what the numbers say`);
                }}
              >
                Use the numbers again
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void requestClose();
              }}
            >
              Cancel
            </Button>
            <Button
              color="module"
              size="sm"
              disabled={!moved || save.isPending}
              onClick={() => {
                write(form, `${what} is ranked the way you said`);
              }}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
