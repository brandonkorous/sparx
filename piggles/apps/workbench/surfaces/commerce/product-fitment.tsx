'use client';

// FITMENT — what this product fits, so a shopper only ever sees parts that work
// with the thing they own.
//
// A product-scoped facet pane, implementing the contract in product-scope.tsx
// verbatim.
//
// ── The data, in one paragraph ───────────────────────────────────────────
//
// A DOMAIN is a kind of thing to match against — vehicles, printers, tractors.
// Each domain declares its axes: `level` axes branch and form a TREE (Make →
// Model → Engine), `range` axes are numeric windows recorded per rule (years,
// weight). A RULE says this product fits one point in that tree — and crucially
// it may stop at ANY depth: a rule attached to "Ford" fits every Ford, and the
// server's lookup treats an ancestor rule as matching a specific query. So the
// picker must let you commit at every level, not only at a leaf.
//
// ── Why the picker drills instead of listing ─────────────────────────────
//
// A real vehicle dictionary is tens of thousands of nodes. A flat list of ids is
// not a fitment editor; neither is a tree that has to be fully loaded to render.
// So it is a column navigator: one level at a time, `GET …/nodes?parentId=`, a
// breadcrumb of where you are, and "everything under here" available at every
// step. Each level is its own long-lived cache entry, so walking back up costs
// nothing.
//
// ── Why the picker is a modal, in an app where a pane is the default ─────
//
// It is a nested picker over work the PANE is holding — the exemption docs/123
// grants `line-editor-modal.tsx` — and the pane declares itself dirty for as
// long as it is open, so the app's unsaved-work safety net still covers it. It
// also wants width the pane may not have: this pane is meant to be docked narrow.
//
// ── There is no Save on this pane, and that is deliberate ────────────────
//
// Every act here commits immediately, because every act here is a discrete
// thing rather than a field in a form: adding a rule is one addition, removing
// one is one removal, and each is meaningful and complete on its own. A draft
// layer over that would be a Save invented to have a Save — and it would put
// the destructive act (removing a rule) inside an ambient "save my changes",
// where nothing names what stops matching.
//
// So removal is its OWN action behind its OWN confirm, naming the exact entry
// and saying what stops happening. Adding goes through `PUT …/fitment`, which
// has no add-one form and replaces the list atomically — so the add sends the
// rules already on the server plus the new one, which is the same write the
// server would have done for an add-one endpoint.

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Heading, Text, useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { faLayerGroup, faPlus, faPuzzlePiece, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  FollowingNotice,
  ProductScopeFallback,
  useProductScope,
  type ProductScope,
} from './product-scope';
import {
  productErrorMessage,
  useDeleteProductFitment,
  useFitmentDomains,
  useProductFitment,
  useSaveProductFitment,
  type ProductFitment,
} from './products-data';
import type { ChosenRule } from './fitment-choice';
import { FitmentPicker } from './product-fitment-picker';
import { rangeLabel, ruleTitle } from './fitment-rule-words';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { ActionLabel } from '../../components/action-label';

/**
 * This pane's subject as a lowercase noun phrase, for the middle of a sentence.
 * NOT the tab title: that is the catalog's, so the brand's rename reaches it.
 * See `ProductScopeOptions.noun`.
 */
const NOUN = 'what this fits';
/** Registry module for this pane, so the brand draws Sell's own picture in the
 *  empty, waiting and failed states rather than the generic one. */
const MODULE = 'commerce';
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

type ReadyScope = Extract<ProductScope, { state: 'ready' }>;

/** A rule the picker hands back, not on the server yet (see fitment-choice.ts). */
type NewRule = ChosenRule;

/* ── The pane ───────────────────────────────────────────────────────────── */

function FitmentBody({
  ctx,
  scope,
  picking,
  setPicking,
}: {
  ctx: SurfaceContext;
  scope: ReadyScope;
  picking: boolean;
  setPicking: (open: boolean) => void;
}) {
  const productId = scope.productId;
  const toast = useToast();
  const confirm = useConfirm();

  const fitment = useProductFitment(productId);
  const domainsQuery = useFitmentDomains();
  const add = useSaveProductFitment(productId);
  const remove = useDeleteProductFitment(productId);

  const domains = domainsQuery.data ?? [];
  // Memoised because `?? []` mints a fresh array every render, which would
  // rebuild the per-domain grouping below on every render of the pane.
  const rules = useMemo(() => fitment.data ?? [], [fitment.data]);

  const byDomain = useMemo(() => {
    const map = new Map<string, ProductFitment[]>();
    for (const rule of rules) {
      const list = map.get(rule.domainId);
      if (list) list.push(rule);
      else map.set(rule.domainId, [rule]);
    }
    return map;
  }, [rules]);

  /**
   * Add one rule.
   *
   * `PUT …/fitment` is a whole-list replace with no add-one form, so the write
   * is "everything already there, plus this". Built from the SERVER's copy
   * rather than anything held locally — there is nothing held locally, which is
   * exactly what makes that safe.
   */
  const onAdd = (rule: NewRule) => {
    const domain = domains.find((candidate) => candidate.id === rule.domainId);
    add.mutate(
      [
        ...rules.map((existing) => ({
          domainId: existing.domainId,
          nodeId: existing.nodeId,
          ranges: existing.ranges,
          notes: existing.notes,
        })),
        { domainId: rule.domainId, nodeId: rule.nodeId, ranges: rule.ranges, notes: rule.notes },
      ],
      {
        onSuccess: () => {
          // Close FIRST, announce after, one tick apart — closing unmounts the
          // picker and withdraws its dirty source, so the toast describes a
          // settled state rather than racing it. (It does not silence Base UI's
          // flushSync warning on toast mount; that is app-wide and fires for
          // every invalidate-then-toast save here.)
          setPicking(false);
          afterPaneChange(() => {
            toast.add({ title: `Now fits ${ruleTitle(rule, domain, 'mid')}`, type: 'success' });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add that',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  /** Remove one rule — its own action, its own confirm, naming the exact entry
   *  and what stops happening because of it. */
  const onRemove = async (rule: ProductFitment) => {
    const domain = domains.find((candidate) => candidate.id === rule.domainId);
    const title = ruleTitle(rule, domain, 'mid');
    const ok = await confirm({
      title: `Stop saying this fits ${title}?`,
      description: `Anyone filtering your website by what they own will no longer be shown ${scope.product.title} for ${title}, from the moment you confirm. Nothing else about the product changes, and you can add it again, but nothing here remembers the note or the years you had set on it.`,
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(rule.id, {
      onSuccess: () => {
        toast.add({ title: `No longer fits ${title}`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove that',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  // Every branch below returns a CARD, because the populated one is a run of
  // them — one per compatibility list. A state that skipped the card floated on
  // the pane's recessed surface while its neighbour sat lifted on it, which is
  // what this pane was screenshotted for.
  const body = () => {
    if (fitment.isError || domainsQuery.isError) {
      // A failed FIRST load means there is nothing behind the message, so it is
      // the empty-state shape rather than an Alert — an Alert is a banner over
      // content that is still there. See components/pane-load-error.tsx.
      return (
        <Card>
          <PaneLoadError
            module={MODULE}
            icon={<Icon glyph={faPuzzlePiece} className="size-6" aria-hidden />}
            title="Could not load what this product fits"
            description="This is a problem reaching the server. Nothing about the product has changed. It just could not be read just now."
            onRetry={() => {
              void fitment.refetch();
              void domainsQuery.refetch();
            }}
          />
        </Card>
      );
    }

    if (fitment.isPending || domainsQuery.isPending) {
      return (
        <Card>
          <PaneWaiting module={MODULE} />
        </Card>
      );
    }

    // Nothing to match AGAINST is a different problem from nothing matched YET,
    // and the fix is in a different place — so it gets its own state and its own
    // destination rather than an Add button that opens an empty picker.
    if (domains.length === 0) {
      return (
        <Card>
          <PaneEmpty
            module={MODULE}
            icon={<Icon glyph={faLayerGroup} className="size-6" aria-hidden />}
            title="There is nothing to match against yet"
            description="Before a product can be marked as fitting something, your catalog needs a list of what those things ARE: a list of vehicles, of machine models, of printers. Add one and every product can then be matched against it."
            actions={
              <Button
                size="sm"
                color="module"
                onClick={(event) => {
                  ctx.open('commerce.fitment.list', undefined, {
                    target: event.shiftKey ? 'beside' : 'tab',
                  });
                }}
              >
                Set up a compatibility list
              </Button>
            }
          />
        </Card>
      );
    }

    if (rules.length === 0) {
      return (
        <Card>
          <PaneEmpty
            module={MODULE}
            icon={<Icon glyph={faPuzzlePiece} className="size-6" aria-hidden />}
            title="This product is not matched to anything"
            description="Shoppers using “does this fit what I own?” on your website will never be shown this product. Add what it fits and it starts appearing for the right people."
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  setPicking(true);
                }}
              >
                <Icon glyph={faPlus} className="size-4" aria-hidden />
                Add what it fits
              </Button>
            }
          />
        </Card>
      );
    }

    return (
      <>
        {[...byDomain.entries()].map(([id, list]) => {
          const domain = domains.find((candidate) => candidate.id === id);
          return (
            <section key={id} className="card bg-base-100 flex flex-col gap-3 p-4">
              <div className="border-base-300 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <Heading level={3} className="text-lg font-semibold">
                  {domain?.displayName ?? 'Other'}
                </Heading>
                <Badge color="neutral" variant="outline" size="sm">
                  {list.length === 1 ? '1 entry' : `${String(list.length)} entries`}
                </Badge>
              </div>

              <ul className="flex flex-col">
                {list.map((rule) => (
                  <li
                    key={rule.id}
                    // NOT flex-wrap. In a pane docked at 380px a wrapping row
                    // drops the remove button onto its own line, left-aligned
                    // under the entry it belongs to, where it reads as belonging
                    // to nothing. Pinned right at every width instead.
                    className="border-base-300 flex items-start justify-between gap-2 border-b py-2 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Text className="min-w-0 font-semibold break-words">
                        {ruleTitle(rule, domain)}
                      </Text>
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
                      {rule.notes === null ? null : <Text className="text-sm">{rule.notes}</Text>}
                    </div>
                    {/* Its own action with its own confirm, naming this exact
                        entry — not a subtraction folded into an ambient Save,
                        where nothing would say what stopped matching. */}
                    <Button
                      size="sm"
                      variant="ghost"
                      color="danger"
                      shape="square"
                      className="shrink-0"
                      aria-label={`Stop saying this fits ${ruleTitle(rule, domain, 'mid')}`}
                      title={`Stop saying this fits ${ruleTitle(rule, domain, 'mid')}`}
                      onClick={() => {
                        void onRemove(rule);
                      }}
                    >
                      <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Controls for what it fits"
        status={
          scope.isFollowing ? (
            <Badge color="info" variant="soft" size="sm">
              Following
            </Badge>
          ) : null
        }
        primary={
          /* This pane's primary action, in this pane's own toolbar — not floating
            at the bottom of the list where it would read as belonging to the
            last card rather than to the pane. Its label sheds first when the
            pane is docked narrow; the icon carries it. */
          rules.length > 0 && domains.length > 0 ? (
            <Button
              size="sm"
              color="module"
              className="ml-auto"
              onClick={() => {
                setPicking(true);
              }}
            >
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              <ActionLabel from="md">Add what it fits</ActionLabel>
            </Button>
          ) : null
        }
        refresh={
          <RefreshButton
            isFetching={fitment.isFetching}
            updatedAt={fitment.dataUpdatedAt}
            onRefresh={() => {
              void fitment.refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <FollowingNotice scope={scope} />
          {body()}
        </div>
      </div>

      {/* Mounted only while open, so every visit starts at the top of the tree
          rather than wherever the last one was abandoned. */}
      {picking ? (
        <FitmentPicker
          open
          domains={domains}
          saving={add.isPending}
          onClose={() => {
            setPicking(false);
          }}
          onAdd={onAdd}
        />
      ) : null}
    </div>
  );
}

export function ProductFitmentSurface({ ctx }: { ctx: SurfaceContext }) {
  // Whether the picker is open lives HERE, above the scope hook, so `hold` can
  // be answered: a FOLLOWING pane that re-points while someone is three levels
  // into choosing a vehicle throws that choice away with no dialog.
  //
  // There is no draft beyond that, and no Save — every act on this pane commits
  // on its own. See the header.
  const [picking, setPicking] = useState(false);
  const scope = useProductScope(ctx, { noun: NOUN, hold: picking });

  if (scope.state !== 'ready') {
    return <ProductScopeFallback ctx={ctx} scope={scope} noun={NOUN} module={MODULE} />;
  }
  // Keyed on the product so a following pane that DID move starts clean rather
  // than carrying one product's state onto the next.
  return (
    <FitmentBody
      key={scope.productId}
      ctx={ctx}
      scope={scope}
      picking={picking}
      setPicking={setPicking}
    />
  );
}
