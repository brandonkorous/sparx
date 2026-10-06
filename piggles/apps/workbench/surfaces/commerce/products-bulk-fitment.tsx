'use client';

// Add what the chosen products fit, or take entries off, in one go. Adding never
// takes anything away; removing takes exactly the entries chosen, any years.
// Up to a minute of work, so the pane is dirty while entries are gathered.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Text,
} from '@wizeworks/silicaui-react';
import { faDownLeft, faPuzzlePiece } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { InlineWaiting } from '../../components/inline-waiting';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useFitmentDomains, type FitmentDomain } from './products-data';
import { useFitmentChoice, type FitmentChoice } from './fitment-choice';
import { FitmentChooserFields } from './fitment-chooser';
import { GatheredEntries } from './products-bulk-fitment-entries';
import { useBulkFitmentRun } from './products-bulk-fitment-run';
import { fit, productCount, targetCount, type BulkTarget } from './products-bulk-words';

type Direction = 'add' | 'remove';

const LEAD = {
  add: 'Choose each thing they fit, narrowing it by year if you need to, and add it to the list below. Then add the whole list to every chosen product at once. Nothing they fit already is taken away.',
  remove:
    'Choose what to take off. Taking off an entry takes off everything under it too: take off Chevrolet and they no longer fit any Chevrolet. It comes off every chosen product, whatever years it was set for, along with any note on it. Everything else they fit stays.',
} as const;

function Failure({ text }: { text: string }) {
  return (
    <Alert color="danger" variant="soft" role="alert">
      <AlertContent>
        <AlertTitle>Nothing was changed</AlertTitle>
        <AlertDescription>{text}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function Footer(props: {
  adding: boolean;
  n: number;
  ready: boolean;
  busy: boolean;
  onCancel: () => void;
  onGo: () => void;
}) {
  const { adding, n, ready, busy, onCancel, onGo } = props;
  return (
    <DialogFooter>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
      <Button
        size="sm"
        color={adding ? 'module' : 'danger'}
        disabled={!ready}
        loading={busy}
        onClick={onGo}
      >
        <Icon glyph={faPuzzlePiece} className="size-4" aria-hidden />
        {adding ? `Add to ${productCount(n)}` : `Remove from ${productCount(n)}`}
      </Button>
    </DialogFooter>
  );
}

function GatherButton(props: { adding: boolean; choice: FitmentChoice; onGather: () => void }) {
  const { adding, choice, onGather } = props;
  return (
    <Button
      size="sm"
      color="module"
      variant="soft"
      disabled={choice.problem !== null}
      onClick={onGather}
    >
      <Icon glyph={faDownLeft} className="size-4" aria-hidden />
      {adding ? `Add ${choice.here} to the list` : `Choose ${choice.here}`}
    </Button>
  );
}

function Body(props: {
  direction: Direction;
  target: BulkTarget;
  domains: FitmentDomain[];
  onClose: () => void;
  onDone: () => void;
}) {
  const adding = props.direction === 'add';
  const n = targetCount(props.target);
  const choice = useFitmentChoice(props.domains, true);
  const run = useBulkFitmentRun({ ...props, adding });
  useDirtySource(
    run.entries.length > 0 || choice.started,
    'You were choosing what these products fit and never finished. Close anyway?'
  );
  const gather = () => {
    const rule = choice.build();
    if (!rule) return;
    run.gather(rule);
    choice.stepUp();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) void run.requestClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
        <DialogTitle>{`${adding ? 'Add' : 'Remove'} what ${productCount(n)} ${fit(n)}`}</DialogTitle>
        <DialogDescription>{LEAD[props.direction]}</DialogDescription>
        <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
          <FitmentChooserFields
            choice={choice}
            domains={props.domains}
            withNotes={false}
            withRanges={adding}
            lockDomain={!adding && run.entries.length > 0}
            commit={<GatherButton adding={adding} choice={choice} onGather={gather} />}
          />
          <GatheredEntries
            adding={adding}
            entries={run.entries}
            domains={props.domains}
            onRemove={run.drop}
          />
          {run.failure ? <Failure text={run.failure} /> : null}
        </div>
        <Footer
          adding={adding}
          n={n}
          ready={run.entries.length > 0}
          busy={run.busy}
          onCancel={() => void run.requestClose()}
          onGo={() => void run.submit()}
        />
      </DialogContent>
    </Dialog>
  );
}

function NoLists(props: {
  ctx: SurfaceContext;
  failed: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (props.failed) {
    return (
      <Alert color="danger" variant="soft">
        <AlertContent>
          <AlertTitle>Could not load your compatibility lists</AlertTitle>
          <AlertDescription>
            This is a problem reaching the server. Nothing has been changed.
          </AlertDescription>
        </AlertContent>
        <Button size="sm" color="danger" variant="soft" onClick={props.onRetry}>
          Try again
        </Button>
      </Alert>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <Text>
        Before products can be marked as fitting something, your catalog needs a list of what those
        things are: vehicles, machine models, printers. Set one up and come back.
      </Text>
      <Button
        size="sm"
        color="module"
        onClick={(event) => {
          props.onClose();
          props.ctx.open('commerce.fitment.list', undefined, {
            target: event.shiftKey ? 'beside' : 'tab',
          });
        }}
      >
        Set up a compatibility list
      </Button>
    </div>
  );
}

export function BulkFitmentDialog(props: {
  ctx: SurfaceContext;
  direction: Direction;
  target: BulkTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const domains = useFitmentDomains();
  const list = domains.data ?? [];
  if (list.length > 0) {
    return (
      <PaneScope>
        <Body {...props} domains={list} />
      </PaneScope>
    );
  }
  return (
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) props.onClose();
        }}
      >
        <DialogContent className="flex max-w-lg flex-col">
          <DialogTitle>
            {props.direction === 'add' ? 'Add what they fit' : 'Remove what they fit'}
          </DialogTitle>
          {domains.isPending ? (
            <InlineWaiting label="Loading your compatibility lists…" />
          ) : (
            <NoLists
              ctx={props.ctx}
              failed={domains.isError}
              onRetry={() => void domains.refetch()}
              onClose={props.onClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
