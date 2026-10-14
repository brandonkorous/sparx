'use client';

// The Options tab: the CHOICES a shopper makes (the versions are the Variants tab's).
// Committing takes SKUs off sale, so its button sits at the foot of the sentences
// saying what it will do, never as a generic Save in the toolbar that goes unread.

import { Button, Card, Text } from '@wizeworks/silicaui-react';
import { faPlus, faShapes } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { Product } from './products-data';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { blankOption, MAX_OPTIONS, swap } from './product-options-draft';
import { countOf } from './product-options-words';
import { OptionCard } from './product-options-card';
import { ConsequenceCard } from './product-options-consequence';
import { useOptionsDraft } from './product-options-state';

/** Registry module, so the brand draws Sell's own picture. */
const MODULE = 'commerce';

type OptionsState = ReturnType<typeof useOptionsDraft>;

function OptionsLoadError({ state }: { state: OptionsState }) {
  const { options, variants } = state;
  return (
    <Card>
      <PaneLoadError
        module={MODULE}
        icon={<Icon glyph={faShapes} className="size-6" aria-hidden />}
        title="Could not load this product’s choices"
        description="This is a problem reaching the server. Nothing about the product has changed: how it is sold just could not be read just now."
        error={options.error ?? variants.error}
        noun="product"
        onRetry={() => {
          void options.refetch();
          void variants.refetch();
        }}
      />
    </Card>
  );
}

function OptionCards({ state }: { state: OptionsState }) {
  const { draft, problem, edit } = state;
  return (
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
    </>
  );
}

function AddAnother({ state, onAdd }: { state: OptionsState; onAdd: () => void }) {
  const full = state.draft.length >= MAX_OPTIONS;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Text>
        {full
          ? 'Eight choices is the most a product can have: already far more than a shopper will work through.'
          : `${countOf(state.consequence.combinations, 'combination', 'combinations')} in all.`}
      </Text>
      <Button size="sm" variant="outline" color="module" disabled={full} onClick={onAdd}>
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add another choice
      </Button>
    </div>
  );
}

export function ProductOptionsTab({ product }: { ctx: SurfaceContext; product: Product }) {
  const state = useOptionsDraft(product);
  const { options, variants, draft, dirty, consequence, problem } = state;

  // A failed load REPLACES the form: an empty option editor beside a dead commit
  // button invites rebuilding a lattice on top of nothing.
  if (options.isError || variants.isError) return <OptionsLoadError state={state} />;
  if (options.isPending || variants.isPending) {
    return (
      <Card>
        <PaneWaiting module={MODULE} />
      </Card>
    );
  }
  const addOption = () => {
    state.edit([...draft, blankOption()]);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* No Refresh row: a tab BODY, not a list pane. */}
      {dirty && state.showConsequences ? (
        <ConsequenceCard
          consequence={consequence}
          blocked={problem !== null}
          busy={state.busy}
          onCommit={() => {
            void state.commitDraft();
          }}
          onDiscard={state.discard}
        />
      ) : null}
      {draft.length === 0 ? (
        <NoChoicesYet onAdd={addOption} hadChoices={(options.data ?? []).length > 0} />
      ) : (
        <>
          <OptionCards state={state} />
          <AddAnother state={state} onAdd={addOption} />
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
            ? 'Nothing has changed yet. The summary above says what happens to your existing versions if you go ahead, or put a choice back.'
            : 'There is a single version of this product with one price. Add a choice (Size, Color, Length) if shoppers need to pick between versions.'
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
