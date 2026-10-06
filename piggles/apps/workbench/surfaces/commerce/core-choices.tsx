'use client';

// Core charges set up as choices (issue 057): turn each faked choice into one part
// with a real deposit. A PANE: minutes of review, typed prices the leave-guard must
// see, and products opened beside it to check.

import { useState } from 'react';
import { Button, Card, EmptyState, Text } from '@wizeworks/silicaui-react';
import { faArrowRightArrowLeft } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { PaneWaiting } from '../../components/pane-waiting';
import { RefreshButton } from '../../components/refresh-button';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  useCoreChoices,
  type CoreChoiceCandidate,
  type CoreChoiceConversion,
} from './core-choices-data';
import { blockedBy, isEdited, plural, startingDraft, type ChoiceDraft } from './core-choice-words';
import { useCoreChoiceActions } from './core-choices-actions';
import { ChoiceCard } from './core-choice-card';
import { ByHand, Results } from './core-choices-results';

/** Capped and centred: a pane on a second monitor is otherwise 2000px wide. */
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

type Choices = ReturnType<typeof useCoreChoices>;

/** The typed prices per product, and whether any of them are unsaved. */
function useDrafts(candidates: CoreChoiceCandidate[]) {
  const [drafts, setDrafts] = useState<Record<string, ChoiceDraft>>({});
  const draftOf = (candidate: CoreChoiceCandidate) =>
    drafts[candidate.productId] ?? startingDraft(candidate);
  const edit = (candidate: CoreChoiceCandidate, change: Partial<ChoiceDraft>) => {
    setDrafts((current) => ({
      ...current,
      [candidate.productId]: { ...draftOf(candidate), ...change },
    }));
  };
  const forget = (productIds: string[]) => {
    setDrafts((current) => {
      const next = { ...current };
      for (const id of productIds) delete next[id];
      return next;
    });
  };
  useDirtySource(
    candidates.some((candidate) => {
      const draft = drafts[candidate.productId];
      return draft !== undefined && isEdited(candidate, draft);
    }),
    'You changed prices on Core charges set up as choices and have not changed those products yet. Close anyway?'
  );
  return { draftOf, edit, forget };
}

function Toolbar({
  choices,
  ready,
  busy,
  onChangeAll,
}: {
  choices: Choices;
  ready: number;
  busy: boolean;
  onChangeAll: () => void;
}) {
  return (
    <PaneToolbar
      label="Core charges set up as choices controls"
      status={
        <Text className="text-sm">
          {plural((choices.data ?? []).length, 'product', 'products')}
        </Text>
      }
      statusReady={!choices.isPending}
      statusFailed={choices.isError}
      primary={
        <Button
          size="sm"
          color="module"
          className="ml-auto"
          disabled={ready === 0 || busy}
          loading={busy}
          onClick={onChangeAll}
        >
          Change all {ready}
        </Button>
      }
      refresh={
        <RefreshButton
          isFetching={choices.isFetching}
          updatedAt={choices.data ? choices.dataUpdatedAt : undefined}
          onRefresh={() => {
            void choices.refetch();
          }}
        />
      }
    />
  );
}

/** A failed read, a read in flight, or nothing to change: each says so plainly. */
function NotAList({ choices, ctx }: { choices: Choices; ctx: SurfaceContext }) {
  const icon = <Icon glyph={faArrowRightArrowLeft} className="size-6" aria-hidden />;
  if (choices.isPending) return <PaneWaiting label="Looking for core charges set up as choices…" />;
  const failed = choices.isError;
  const action = failed
    ? { label: 'Try again', run: () => void choices.refetch() }
    : {
        label: 'See the cores owed',
        run: () => ctx.open('commerce.cores.list', undefined, { target: 'tab' }),
      };
  return (
    <Card>
      <EmptyState
        icon={icon}
        title={failed ? 'Could not load these products' : 'No core charges set up as choices'}
        description={
          failed
            ? 'This is a problem reaching the server. Nothing about your products has changed.'
            : 'Every rebuilt part here has a real core deposit, or none at all. When a product sells its core charge as a choice, like “Accept core charge” and “Defer core charge”, it shows here so you can change it to a real deposit.'
        }
        actions={
          <Button size="sm" color="module" onClick={action.run}>
            {action.label}
          </Button>
        }
      />
    </Card>
  );
}

export function CoreChoicesSurface({ ctx }: { ctx: SurfaceContext }) {
  const choices = useCoreChoices();
  const candidates = choices.data ?? [];
  const { draftOf, edit, forget } = useDrafts(candidates);
  const [results, setResults] = useState<CoreChoiceConversion[] | null>(null);
  const { changeOne, changeAll, busy } = useCoreChoiceActions(draftOf, (outcome) => {
    setResults(outcome);
    forget(outcome.filter((result) => result.problem === null).map((result) => result.productId));
  });
  const workable = candidates.filter((candidate) => candidate.problem === null);
  const ready = workable.filter((candidate) => blockedBy(candidate, draftOf(candidate)) === null);
  const openProduct = (id: string) => {
    ctx.open('commerce.product.detail', { id, tab: 'options' }, { target: 'beside' });
  };

  return (
    <div className={PANE_SHELL}>
      <Toolbar
        choices={choices}
        ready={ready.length}
        busy={busy.size > 0}
        onChangeAll={() => void changeAll(ready)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {results ? (
            <Results results={results} onOpen={openProduct} onDone={() => setResults(null)} />
          ) : null}
          {choices.isError || choices.isPending || candidates.length === 0 ? (
            <NotAList choices={choices} ctx={ctx} />
          ) : (
            <ChoiceList
              list={{
                workable,
                byHand: candidates.filter((c) => c.problem !== null),
                busy,
                results,
              }}
              draftOf={draftOf}
              onEdit={edit}
              onOpen={openProduct}
              onChange={(candidate) => void changeOne(candidate)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceList({
  list,
  draftOf,
  onEdit,
  onOpen,
  onChange,
}: {
  list: {
    workable: CoreChoiceCandidate[];
    byHand: CoreChoiceCandidate[];
    busy: Set<string>;
    results: CoreChoiceConversion[] | null;
  };
  draftOf: (candidate: CoreChoiceCandidate) => ChoiceDraft;
  onEdit: (candidate: CoreChoiceCandidate, change: Partial<ChoiceDraft>) => void;
  onOpen: (productId: string) => void;
  onChange: (candidate: CoreChoiceCandidate) => void;
}) {
  const failedOn = (id: string) =>
    list.results?.find((result) => result.productId === id)?.problem ?? null;
  return (
    <>
      <Text>
        Your old store sold each of these rebuilt parts as two versions: one where the buyer pays a
        core charge and it ships now, and one where the buyer sends the old part first. Changing one
        makes it a single part with one stock count and a real core deposit, which comes back when
        the old part does.
      </Text>
      {list.workable.map((candidate) => (
        <ChoiceCard
          key={candidate.productId}
          candidate={candidate}
          draft={draftOf(candidate)}
          busy={list.busy.has(candidate.productId)}
          locked={list.busy.size > 0}
          failed={failedOn(candidate.productId)}
          onEdit={(change) => onEdit(candidate, change)}
          onOpen={() => onOpen(candidate.productId)}
          onChange={() => onChange(candidate)}
        />
      ))}
      {list.byHand.length > 0 ? <ByHand candidates={list.byHand} onOpen={onOpen} /> : null}
    </>
  );
}
