'use client';

// Add what the chosen products fit, or take entries off them, in one go.
//
// A dialog over the list, like the product's own picker: the chosen products are
// the pane's selection and nothing else needs to be on screen. It can hold a
// minute of work (four engines, each with its years), so for as long as it holds
// any the pane says it is dirty and closing it asks first.
//
// ADDING NEVER TAKES ANYTHING AWAY. Each product keeps everything it already
// fits, and an entry it already has with the same years is skipped. Removing
// takes off exactly the entries chosen here, whatever years they were set for.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { CornerDownLeft, Puzzle, X } from 'lucide-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { productErrorMessage, useFitmentDomains, type FitmentDomain } from './products-data';
import { FitmentChooserFields, useFitmentChoice, type ChosenRule } from './fitment-chooser';
import { rangeLabel, ruleTitle } from './fitment-rule-words';
import { useBulkAddFitment, useBulkRemoveFitment } from './products-bulk';
import {
  entriesPhrase,
  fitmentAddedToast,
  fitmentRemovedToast,
  fit,
  productCount,
  targetCount,
  type BulkTarget,
} from './products-bulk-words';

type Direction = 'add' | 'remove';

/** Same entry, same windows: the same rule, listed once. */
function entryKey(rule: ChosenRule, direction: Direction): string {
  const ranges =
    direction === 'add'
      ? rule.ranges.map((r) => `${r.dimensionKey}=${String(r.min)}..${String(r.max)}`).join(',')
      : '';
  return `${rule.domainId}|${rule.nodeId ?? '*'}|${ranges}`;
}

function Entries({
  entries,
  domains,
  onRemove,
}: {
  entries: ChosenRule[];
  domains: FitmentDomain[];
  onRemove: (index: number) => void;
}) {
  return (
    <Card className="border-base-300 flex flex-col border p-3">
      <ul className="flex flex-col">
        {entries.map((rule, index) => {
          const domain = domains.find((candidate) => candidate.id === rule.domainId);
          const title = ruleTitle(rule, domain);
          return (
            <li
              key={`${title}-${String(index)}`}
              className="border-base-300 flex items-start justify-between gap-2 border-b py-2 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Text className="min-w-0 font-semibold break-words">{title}</Text>
                {rule.ranges.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {rule.ranges.map((range) => (
                      <Badge key={range.dimensionKey} color="module" variant="soft" size="sm">
                        {rangeLabel(
                          range,
                          domain?.dimensions.find((d) => d.key === range.dimensionKey)
                        )}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              {/* Colorless: this only edits the list being built here, nothing
                  saved, so it is a dismiss rather than a destructive act. */}
              <Button
                size="sm"
                variant="ghost"
                shape="square"
                className="shrink-0"
                aria-label={`Leave out ${title}`}
                title={`Leave out ${title}`}
                onClick={() => {
                  onRemove(index);
                }}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Body({
  direction,
  target,
  domains,
  onClose,
  onDone,
}: {
  direction: Direction;
  target: BulkTarget;
  domains: FitmentDomain[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const choice = useFitmentChoice(domains, true);
  const add = useBulkAddFitment();
  const remove = useBulkRemoveFitment();
  const [entries, setEntries] = useState<ChosenRule[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const adding = direction === 'add';
  const n = targetCount(target);
  const busy = add.isPending || remove.isPending;

  useDirtySource(
    entries.length > 0 || choice.started,
    adding
      ? 'You were choosing what these products fit and never added it. Close anyway?'
      : 'You were choosing what to take off these products and never did it. Close anyway?'
  );

  const gather = () => {
    const rule = choice.build();
    if (!rule) return;
    setEntries((current) =>
      current.some((entry) => entryKey(entry, direction) === entryKey(rule, direction))
        ? current
        : [...current, rule]
    );
    choice.stepUp();
  };

  const what = entriesPhrase(
    entries.map((rule) =>
      ruleTitle(
        rule,
        domains.find((d) => d.id === rule.domainId),
        'mid'
      )
    )
  );

  /** Escape, the backdrop and Cancel all come here: a list of entries is a
   *  minute of work, so leaving with one asks first. */
  const requestClose = async () => {
    if (busy) return;
    if (entries.length > 0) {
      const leave = await confirm({
        title: adding ? 'Leave without adding these?' : 'Leave without removing these?',
        description: `The ${entries.length === 1 ? 'entry' : `${String(entries.length)} entries`} you chose here will be forgotten. Nothing has been changed on any product.`,
        confirmLabel: 'Leave',
        cancelLabel: 'Keep choosing',
        color: 'warning',
      });
      if (!leave) return;
    }
    onClose();
  };

  const finish = (words: { title: string; description?: string }, changed: number) => {
    onClose();
    if (changed > 0) onDone();
    afterPaneChange(() => {
      toast.add({ ...words, type: changed > 0 ? 'success' : 'info' });
    });
  };

  const submit = async () => {
    setFailure(null);
    try {
      if (adding) {
        const result = await add.mutateAsync({
          target,
          fitments: entries.map((rule) => ({
            domainId: rule.domainId,
            nodeId: rule.nodeId,
            ranges: rule.ranges,
          })),
        });
        finish(fitmentAddedToast(result, what), result.productsChanged);
      } else {
        const result = await remove.mutateAsync({
          target,
          domainId: entries[0]?.domainId ?? '',
          nodeIds: entries.map((rule) => rule.nodeId),
        });
        finish(fitmentRemovedToast(result, what), result.productsChanged);
      }
    } catch (error) {
      setFailure(productErrorMessage(error, 'This is a problem reaching the server.'));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) void requestClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
        <DialogTitle>
          {`${adding ? 'Add' : 'Remove'} what ${productCount(n)} ${fit(n)}`}
        </DialogTitle>
        <DialogDescription>
          {adding
            ? 'Choose each thing they fit, narrowing it by year if you need to, and add it to the list below. Then add the whole list to every chosen product at once. Nothing they fit already is taken away.'
            : 'Choose what to take off. Taking off an entry takes off everything under it too: take off Chevrolet and they no longer fit any Chevrolet. It comes off every chosen product, whatever years it was set for, along with any note on it. Everything else they fit stays.'}
        </DialogDescription>

        <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
          <FitmentChooserFields
            choice={choice}
            domains={domains}
            withNotes={false}
            withRanges={adding}
            lockDomain={!adding && entries.length > 0}
            commit={
              <Button
                size="sm"
                color="module"
                variant="soft"
                disabled={choice.problem !== null}
                onClick={gather}
              >
                <CornerDownLeft className="size-4" aria-hidden />
                {adding ? `Add ${choice.here} to the list` : `Choose ${choice.here}`}
              </Button>
            }
          />

          {entries.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Text className="font-semibold">
                {adding ? 'To add to every chosen product' : 'To take off every chosen product'}
              </Text>
              <Entries
                entries={entries}
                domains={domains}
                onRemove={(index) => {
                  setEntries((current) => current.filter((_, i) => i !== index));
                }}
              />
            </div>
          ) : (
            <Text>
              {adding
                ? 'Nothing on the list yet. Find an entry above and press its Add button.'
                : 'Nothing chosen yet. Find an entry above and press its Choose button.'}
            </Text>
          )}

          {failure ? (
            <Alert color="danger" variant="soft" role="alert">
              <AlertContent>
                <AlertTitle>Nothing was changed</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              void requestClose();
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            color={adding ? 'module' : 'danger'}
            disabled={entries.length === 0}
            loading={busy}
            onClick={() => {
              void submit();
            }}
          >
            <Puzzle className="size-4" aria-hidden />
            {adding ? `Add to ${productCount(n)}` : `Remove from ${productCount(n)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkFitmentDialog({
  ctx,
  direction,
  target,
  onClose,
  onDone,
}: {
  ctx: SurfaceContext;
  direction: Direction;
  target: BulkTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const domains = useFitmentDomains();
  const list = domains.data ?? [];

  const fallback = () => {
    if (domains.isError) {
      return (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>Could not load your compatibility lists</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server. Nothing has been changed.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="danger"
            variant="soft"
            onClick={() => {
              void domains.refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      );
    }
    if (domains.isPending) return <Text role="status">Loading your compatibility lists…</Text>;
    return (
      <div className="flex flex-col items-start gap-3">
        <Text>
          Before products can be marked as fitting something, your catalog needs a list of what
          those things are: vehicles, machine models, printers. Set one up and come back.
        </Text>
        <Button
          size="sm"
          color="module"
          onClick={(event) => {
            onClose();
            ctx.open('commerce.fitment.list', undefined, {
              target: event.shiftKey ? 'beside' : 'tab',
            });
          }}
        >
          Set up a compatibility list
        </Button>
      </div>
    );
  };

  // PaneScope portals into the pane that opened it: a modal in a multi-document
  // interface belongs to ONE document, not the whole app.
  return (
    <PaneScope>
      {list.length > 0 ? (
        <Body
          direction={direction}
          target={target}
          domains={list}
          onClose={onClose}
          onDone={onDone}
        />
      ) : (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
        >
          <DialogContent className="flex max-w-lg flex-col">
            <DialogTitle>
              {direction === 'add' ? 'Add what they fit' : 'Remove what they fit'}
            </DialogTitle>
            {fallback()}
          </DialogContent>
        </Dialog>
      )}
    </PaneScope>
  );
}
