'use client';

// The Options tab — the CHOICES a shopper makes. The sellable versions at each
// point of the grid are the Variants tab's business.
//
// This tab saves a RESTRUCTURING, not a field: the endpoint REPLACES the whole
// lattice, so everything typed is a draft turned continuously into sentences
// about what committing would do (product-options-plan.ts).
//
// Which is why the commit button lives at the foot of those sentences rather
// than in the toolbar: committing takes SKUs off sale, and a generic Save in
// the chrome is what people press unread.

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Text, useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { faPlus, faShapes } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  LatticeRebindError,
  productErrorMessage,
  useProductOptions,
  useProductVariants,
  useSaveProductLattice,
  type Product,
} from './products-data';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  blankOption,
  cleanDraft,
  fingerprint,
  MAX_OPTIONS,
  problemWith,
  swap,
  toDraft,
  type OptionDraft,
} from './product-options-draft';
import { consequenceOf, planOf } from './product-options-plan';
import { committedToast, consequenceLines, countOf, rebindToast } from './product-options-words';
import { OptionCard } from './product-options-card';
import { ConsequenceCard } from './product-options-consequence';

/** Registry module, so the brand draws Sell's own picture. */
const MODULE = 'commerce';

export function ProductOptionsTab({ product }: { ctx: SurfaceContext; product: Product }) {
  const toast = useToast();
  const confirm = useConfirm();

  const options = useProductOptions(product.id);
  // Retired versions too: one whose choice is being put back comes back with it,
  // and a summary that cannot see them calls their combinations blank and sends
  // somebody to recreate versions that already exist (issue 305).
  const variants = useProductVariants(product.id, true);
  const commitLattice = useSaveProductLattice(product.id);

  const saved = useMemo(() => toDraft(options.data ?? []), [options.data]);
  const [draft, setDraft] = useState<OptionDraft[]>(saved);
  const [touched, setTouched] = useState(false);

  // Track the server's copy while this form is CLEAN. A dirty one is never
  // overwritten by a refetch.
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  // NOT `useTabSave` — the leave-guard and the dirty dot only.
  const dirty = fingerprint(draft) !== fingerprint(saved);
  useDirtySource(
    dirty,
    'The choices on this product have unsaved changes on the Options tab. Close anyway?'
  );

  const consequence = useMemo(
    () => consequenceOf(draft, options.data ?? [], variants.data ?? []),
    [draft, options.data, variants.data]
  );
  const problem = problemWith(draft);

  // "0 combinations can be sold" is untrue of a form still being filled in, so
  // the summary waits for something real to describe or something real at risk.
  const showConsequences = cleanDraft(draft).length > 0 || (options.data ?? []).length > 0;

  const edit = (next: OptionDraft[]) => {
    setTouched(true);
    setDraft(next);
  };

  const commit = async () => {
    if (problem) return;
    const ok = await confirm({
      title: `Change how ${product.title} is sold?`,
      description: consequenceLines(consequence).join(' '),
      confirmLabel: 'Change how it is sold',
      cancelLabel: 'Go back',
      color: consequence.retire.length > 0 ? 'danger' : 'warning',
    });
    if (!ok) return;

    commitLattice.mutate(planOf(draft, consequence), {
      onSuccess: () => {
        setTouched(false);
        toast.add(committedToast(consequence));
      },
      onError: (error) => {
        if (error instanceof LatticeRebindError) {
          setTouched(false);
          toast.add(rebindToast(error.variantIds.length));
          return;
        }
        toast.add({
          title: 'Could not change how this is sold',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  // A failed load REPLACES the form — an empty option editor beside a dead
  // commit button invites rebuilding a lattice on top of nothing.
  if (options.isError || variants.isError) {
    return (
      <Card>
        <PaneLoadError
          module={MODULE}
          icon={<Icon glyph={faShapes} className="size-6" aria-hidden />}
          title="Could not load this product’s choices"
          description="This is a problem reaching the server. Nothing about the product has changed — how it is sold just could not be read just now."
          onRetry={() => {
            void options.refetch();
            void variants.refetch();
          }}
        />
      </Card>
    );
  }

  if (options.isPending || variants.isPending) {
    return (
      <Card>
        <PaneWaiting module={MODULE} />
      </Card>
    );
  }

  const addOption = () => {
    edit([...draft, blankOption()]);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* No Refresh row: a tab BODY, not a list pane. */}
      {dirty && showConsequences ? (
        <ConsequenceCard
          consequence={consequence}
          blocked={problem !== null}
          busy={commitLattice.isPending}
          onCommit={() => {
            void commit();
          }}
          onDiscard={() => {
            setTouched(false);
            setDraft(saved);
          }}
        />
      ) : null}

      {draft.length === 0 ? (
        <NoChoicesYet onAdd={addOption} hadChoices={(options.data ?? []).length > 0} />
      ) : (
        <>
          {draft.map((option, index) => (
            <OptionCard
              key={option.key}
              option={option}
              problem={problem?.key === option.key ? problem : null}
              canMoveUp={index > 0}
              canMoveDown={index < draft.length - 1}
              onChange={(change) => {
                edit(
                  draft.map((entry) => (entry.key === option.key ? { ...entry, ...change } : entry))
                );
              }}
              onMove={(direction) => {
                edit(swap(draft, index, index + direction));
              }}
              onRemove={() => {
                edit(draft.filter((entry) => entry.key !== option.key));
              }}
            />
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Text>
              {draft.length >= MAX_OPTIONS
                ? 'Eight choices is the most a product can have — already far more than a shopper will work through.'
                : `${countOf(consequence.combinations, 'combination', 'combinations')} in all.`}
            </Text>
            <Button
              size="sm"
              variant="outline"
              color="module"
              disabled={draft.length >= MAX_OPTIONS}
              onClick={addOption}
            >
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              Add another choice
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Nothing set up yet ─────────────────────────────────────────────────── */

function NoChoicesYet({ onAdd, hadChoices }: { onAdd: () => void; hadChoices: boolean }) {
  // Carded, because the branch beside it is a stack of FormSections.
  return (
    <Card>
      <PaneEmpty
        module={MODULE}
        icon={<Icon glyph={faShapes} className="size-6" aria-hidden />}
        // "You removed them" and "you never had any" read identically if only
        // one is written, and the first is where a stray click costs SKUs.
        title={hadChoices ? 'You have removed every choice' : 'This product is sold one way'}
        description={
          hadChoices
            ? 'Nothing has changed yet. The summary above says what happens to your existing versions if you go ahead — or put a choice back.'
            : 'There is a single version of this product with one price. Add a choice — Size, Color, Length — if shoppers need to pick between versions.'
        }
        actions={
          <Button size="sm" color="module" onClick={onAdd}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add a choice
          </Button>
        }
      />
    </Card>
  );
}
