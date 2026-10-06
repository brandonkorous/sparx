'use client';

// Core charges set up as choices (sparx persona issue 057).
//
// A store with no core deposit faked one with a choice on every rebuilt part:
// "Accept Core Charge (+$150)" at $730.15 and "Defer Core Charge" at $600.00.
// That is one part on one shelf sold as two versions, so its stock is split in
// two, and the extra on the dearer side is a deposit nobody can give back.
// Gillett Diesel moved in with 84 of them.
//
// This screen turns each into one part with a real deposit, still letting the
// buyer send the old part first when the store offered that. The deposit comes
// from the WORDS, never the price difference, because the two rarely agree; so
// every product shows what a buyer pays today beside what they will pay after,
// and the owner can change either figure before anything happens.
//
// A PANE, not a dialog: it is minutes of review across dozens of products, the
// typed prices are unsaved work the leave-guard has to see, and the owner opens
// products beside it to check them.

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { ArrowLeftRight } from 'lucide-react';
import { MoneyCentsInput } from '@/components/money-input';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { useConfirm } from '../../lib/confirm';
import { apiErrorMessage } from '../../lib/api-error';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatMoney } from './data';
import {
  useConvertCoreChoices,
  useCoreChoices,
  type CoreChoiceCandidate,
  type CoreChoiceConversion,
} from './core-choices-data';
import {
  blockedBy,
  changeAllWords,
  changedWords,
  stuckDetail,
  stuckWords,
  changeFor,
  isEdited,
  plural,
  priceShift,
  rowState,
  sharesOnePrice,
  startingDraft,
  whatHappens,
  type ChoiceDraft,
  type CoreChoiceChange,
} from './core-choice-words';

/** The most one request may carry; a longer run goes in several. */
const BATCH = 500;

/** The one column everything sits in: a pane torn onto a second monitor is
 *  otherwise 2000px wide with the prices pinned to the left edge. */
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function CoreChoicesSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const confirm = useConfirm();
  const choices = useCoreChoices();
  const convert = useConvertCoreChoices();
  const [drafts, setDrafts] = useState<Record<string, ChoiceDraft>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<CoreChoiceConversion[] | null>(null);

  const candidates = choices.data ?? [];
  const draftOf = (candidate: CoreChoiceCandidate) =>
    drafts[candidate.productId] ?? startingDraft(candidate);
  const workable = candidates.filter((candidate) => candidate.problem === null);
  const byHand = candidates.filter((candidate) => candidate.problem !== null);
  const ready = workable.filter((candidate) => blockedBy(candidate, draftOf(candidate)) === null);

  useDirtySource(
    candidates.some((candidate) => {
      const draft = drafts[candidate.productId];
      return draft !== undefined && isEdited(candidate, draft);
    }),
    'You changed prices on Core charges set up as choices and have not changed those products yet. Close anyway?'
  );

  const edit = (candidate: CoreChoiceCandidate, change: Partial<ChoiceDraft>) => {
    setDrafts((current) => ({
      ...current,
      [candidate.productId]: {
        ...(current[candidate.productId] ?? startingDraft(candidate)),
        ...change,
      },
    }));
  };

  const openProduct = (productId: string) => {
    ctx.open('commerce.product.detail', { id: productId, tab: 'options' }, { target: 'beside' });
  };

  /** Send the changes, in batches the server takes, and report every product. */
  const run = async (changes: CoreChoiceChange[]) => {
    const ids = changes.map((change) => change.productId);
    setBusy(new Set(ids));
    const outcome: CoreChoiceConversion[] = [];
    try {
      for (let start = 0; start < changes.length; start += BATCH) {
        outcome.push(...(await convert.mutateAsync(changes.slice(start, start + BATCH))));
      }
    } catch (error) {
      toast.add({
        title: 'Could not change them',
        description: apiErrorMessage(
          error,
          outcome.length > 0
            ? `${plural(outcome.length, 'product was', 'products were')} dealt with before this stopped. They are listed below.`
            : 'Nothing was changed. You can try again.'
        ),
        type: 'error',
      });
    } finally {
      setBusy(new Set());
    }
    if (outcome.length === 0) return;
    setResults(outcome);
    const changed = outcome.filter((result) => result.problem === null);
    setDrafts((current) => {
      const next = { ...current };
      for (const result of changed) delete next[result.productId];
      return next;
    });
    const stuck = outcome.length - changed.length;
    toast.add({
      title:
        changed.length > 0
          ? `Changed ${plural(changed.length, 'product', 'products')}`
          : 'Nothing was changed',
      description: stuck > 0 ? stuckWords(stuck) : changedWords(changed.length),
      type: stuck > 0 ? 'warning' : 'success',
    });
  };

  const changeOne = async (candidate: CoreChoiceCandidate) => {
    const draft = draftOf(candidate);
    const ok = await confirm({
      title: `Change ${candidate.title}?`,
      description: whatHappens(candidate, draft),
      confirmLabel: 'Change it',
      cancelLabel: 'Leave it as it is',
      color: 'danger',
    });
    if (!ok) return;
    await run([changeFor(candidate, draft)]);
  };

  const changeAll = async () => {
    if (ready.length === 0) return;
    const offering = ready.filter((candidate) => draftOf(candidate).offerFirst).length;
    const ok = await confirm({
      title: `Change all ${plural(ready.length, 'product', 'products')}?`,
      description: changeAllWords(ready.length, offering),
      confirmLabel: `Change ${plural(ready.length, 'product', 'products')}`,
      cancelLabel: 'Leave them as they are',
      color: 'danger',
    });
    if (!ok) return;
    await run(ready.map((candidate) => changeFor(candidate, draftOf(candidate))));
  };

  const problemOf = (productId: string) =>
    results?.find((result) => result.productId === productId)?.problem ?? null;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Core charges set up as choices controls"
        status={<Text className="text-sm">{plural(candidates.length, 'product', 'products')}</Text>}
        statusReady={!choices.isPending}
        statusFailed={choices.isError}
        primary={
          <Button
            size="sm"
            color="module"
            className="ml-auto"
            disabled={ready.length === 0 || busy.size > 0}
            loading={busy.size > 1}
            onClick={() => {
              void changeAll();
            }}
          >
            Change all {ready.length}
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {results ? (
            <Results
              results={results}
              onOpen={openProduct}
              onDone={() => {
                setResults(null);
              }}
            />
          ) : null}

          {choices.isError ? (
            <Card>
              <EmptyState
                icon={<ArrowLeftRight className="size-6" aria-hidden />}
                title="Could not load these products"
                description="This is a problem reaching the server. Nothing about your products has changed."
                actions={
                  <Button
                    size="sm"
                    color="module"
                    onClick={() => {
                      void choices.refetch();
                    }}
                  >
                    Try again
                  </Button>
                }
              />
            </Card>
          ) : choices.isPending ? (
            <p className="p-4" role="status">
              Looking for core charges set up as choices…
            </p>
          ) : candidates.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ArrowLeftRight className="size-6" aria-hidden />}
                title="No core charges set up as choices"
                description="Every rebuilt part here has a real core deposit, or none at all. When a product sells its core charge as a choice, like “Accept core charge” and “Defer core charge”, it shows here so you can change it to a real deposit."
                actions={
                  <Button
                    size="sm"
                    color="module"
                    onClick={() => {
                      ctx.open('commerce.cores.list', undefined, { target: 'tab' });
                    }}
                  >
                    See the cores owed
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <Text>
                Your old store sold each of these rebuilt parts as two versions: one where the buyer
                pays a core charge and it ships now, and one where the buyer sends the old part
                first. Changing one makes it a single part with one stock count and a real core
                deposit, which comes back when the old part does.
              </Text>
              {workable.map((candidate) => (
                <ChoiceCard
                  key={candidate.productId}
                  candidate={candidate}
                  draft={draftOf(candidate)}
                  busy={busy.has(candidate.productId)}
                  locked={busy.size > 0}
                  failed={problemOf(candidate.productId)}
                  onEdit={(change) => {
                    edit(candidate, change);
                  }}
                  onOpen={() => {
                    openProduct(candidate.productId);
                  }}
                  onChange={() => {
                    void changeOne(candidate);
                  }}
                />
              ))}
              {byHand.length > 0 ? <ByHand candidates={byHand} onOpen={openProduct} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  candidate,
  draft,
  busy,
  locked,
  failed,
  onEdit,
  onOpen,
  onChange,
}: {
  candidate: CoreChoiceCandidate;
  draft: ChoiceDraft;
  busy: boolean;
  locked: boolean;
  failed: string | null;
  onEdit: (change: Partial<ChoiceDraft>) => void;
  onOpen: () => void;
  onChange: () => void;
}) {
  const { currency } = candidate;
  const state = rowState(candidate, draft);
  const blocked = blockedBy(candidate, draft);
  const shift = priceShift(candidate, draft);
  const needsDeposit = draft.depositCents === undefined || draft.depositCents <= 0;

  return (
    <section className="card bg-base-100 flex flex-col gap-4 p-4">
      <div className="border-base-300 flex items-start justify-between gap-3 border-b pb-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading level={2} className="text-lg font-semibold">
            <button type="button" className="link link-hover text-left" onClick={onOpen}>
              {candidate.title}
            </button>
          </Heading>
          <span className="font-mono text-sm break-all">{candidate.keptSku}</span>
        </div>
        <Badge color={state.tone} variant="soft" size="sm" className="shrink-0">
          {state.label}
        </Badge>
      </div>

      <div className="flex flex-col gap-4 @2xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Heading level={3} className="text-base font-semibold">
            Sold today as
          </Heading>
          <dl className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0">“{candidate.depositLabel}”</dt>
              <dd className="tabular-nums">
                {formatMoney(candidate.depositSidePriceCents / 100, currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0">“{candidate.firstLabel}”</dt>
              <dd className="tabular-nums">
                {formatMoney(candidate.firstSidePriceCents / 100, currency)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Heading level={3} className="text-base font-semibold">
            Becomes
          </Heading>
          <div className="flex flex-col gap-3 @md:flex-row">
            {sharesOnePrice(candidate) ? (
              <Field className="min-w-0 flex-1">
                <FieldLabel required>Part price</FieldLabel>
                <FieldControl
                  render={
                    <MoneyCentsInput
                      color={draft.partProblem ? 'error' : 'module'}
                      size="sm"
                      cents={draft.partCents}
                      disabled={locked}
                      aria-label={`Part price for ${candidate.title}`}
                      onCentsChange={(reading) => {
                        onEdit({ partCents: reading.cents, partProblem: reading.problem });
                      }}
                    />
                  }
                />
                <FieldDescription>What the part costs on its own.</FieldDescription>
              </Field>
            ) : (
              <Text className="min-w-0 flex-1">
                It has other choices too, so each of its {candidate.groups} versions keeps its own
                price: today’s old-part-first price.
              </Text>
            )}
            <Field className="min-w-0 flex-1">
              <FieldLabel required>Core deposit</FieldLabel>
              <FieldControl
                render={
                  <MoneyCentsInput
                    color={draft.depositProblem ? 'error' : 'module'}
                    size="sm"
                    cents={draft.depositCents}
                    disabled={locked}
                    aria-label={`Core deposit for ${candidate.title}`}
                    onCentsChange={(reading) => {
                      onEdit({ depositCents: reading.cents, depositProblem: reading.problem });
                    }}
                  />
                }
              />
              <FieldDescription>Paid back when the old part comes in.</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel>Buyers can still send their old part first</FieldLabel>
            <FieldControl
              render={
                <Switch
                  color="module"
                  checked={draft.offerFirst}
                  disabled={locked}
                  onCheckedChange={(next: boolean) => {
                    onEdit({ offerFirst: next });
                  }}
                />
              }
            />
            <FieldDescription>
              No deposit. The part is held until the old one arrives.
            </FieldDescription>
          </Field>
        </div>
      </div>

      {shift ? <Text className="font-medium">{shift}</Text> : null}
      {blocked && !needsDeposit ? <FieldStatus status="error">{blocked}</FieldStatus> : null}
      {blocked && needsDeposit ? <FieldStatus status="warning">{blocked}</FieldStatus> : null}
      {failed ? <FieldStatus status="error">{failed}</FieldStatus> : null}

      <div className="flex justify-end">
        <Button
          size="sm"
          color="module"
          variant="outline"
          disabled={blocked !== null || locked}
          loading={busy}
          onClick={onChange}
        >
          Change this one
        </Button>
      </div>
    </section>
  );
}

/** Products the reader could not place: two core choices, a choice that is not
 *  one of each side, or stock still on the version that would go. Each says why
 *  and opens on its Options tab, where it is fixed. */
function ByHand({
  candidates,
  onOpen,
}: {
  candidates: CoreChoiceCandidate[];
  onOpen: (productId: string) => void;
}) {
  return (
    <FormSection
      title={`Change ${candidates.length === 1 ? 'this one' : `these ${String(candidates.length)}`} by hand first`}
      description="Each needs a fix on the product before it can change here."
    >
      <ul className="flex flex-col">
        {candidates.map((candidate) => (
          <li
            key={candidate.productId}
            className="border-base-300 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
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

/** What the last change did, product by product. Changed products leave the list
 *  above, so this is the only place the ones that did NOT change say why. */
function Results({
  results,
  onOpen,
  onDone,
}: {
  results: CoreChoiceConversion[];
  onOpen: (productId: string) => void;
  onDone: () => void;
}) {
  const changed = results.filter((result) => result.problem === null);
  const stuck = results.filter((result) => result.problem !== null);
  return (
    <FormSection
      title={
        stuck.length === 0
          ? `Changed ${plural(changed.length, 'product', 'products')}`
          : `Changed ${String(changed.length)} of ${plural(results.length, 'product', 'products')}`
      }
      description={stuck.length === 0 ? changedWords(changed.length) : stuckDetail(stuck.length)}
      action={
        <Button size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
      }
    >
      {stuck.length === 0 ? null : (
        <ul className="flex flex-col">
          {stuck.map((result) => (
            <li
              key={result.productId}
              className="border-base-300 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b py-2 first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <button
                  type="button"
                  className="link link-hover text-left font-medium"
                  onClick={() => {
                    onOpen(result.productId);
                  }}
                >
                  {result.title}
                </button>
                <FieldStatus status="error">{result.problem}</FieldStatus>
              </div>
              <Badge color="error" variant="soft" size="sm">
                Not changed
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
