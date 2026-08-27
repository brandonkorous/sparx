'use client';

// The empty states for the stock list — five different problems that all render
// as "no rows", split out because deciding WHICH nothing this is has nothing to
// do with drawing a table. Two of the five are good news.
//
// ── Nothing here describes a journey ─────────────────────────────────────
//
// The bare state used to read "Open a product and use its Stock panel to count
// it for the first time". The panel is real and good, but it is a dockable pane
// listed as "How many you have", not a tab on the product — so an owner who did
// exactly what the sentence said opened a product, found seven tabs, none of
// them Stock, and concluded she was missing something (issue 173). A sentence
// that names a place is a promise about where a thing is. These name the
// action instead, and carry the button that performs it.

import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { faArrowTrendDown, faBoxes, faBoxOpen } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { openProductFacet } from '../commerce/product-scope';
import { useScopeHasStock, type CatalogMatch } from './data';
import type { StockLevelFilter } from './stock-list-toolbar';

/**
 * What to try when nothing matched — naming ONLY what is actually narrowing the
 * list. Telling someone to clear a filter they never set sends them hunting for
 * a control that is already off.
 */
export function emptyAdvice(search: string, locationName: string | null): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of a product code or a product name.');
  if (locationName) {
    parts.push(
      `You are only seeing stock kept at ${locationName} — switch to every location for the rest.`
    );
  }
  return parts.join(' ');
}

interface EmptyProps {
  ctx: SurfaceContext;
  search: string;
  /** Which location is chosen, for the probe. Empty means every location. */
  locationId: string;
  locationName: string | null;
  level: StockLevelFilter;
  narrowed: boolean;
  /** Products the search found that simply have no count behind them. */
  catalogMatches: CatalogMatch[];
  /** Still asking the catalog, so we do not answer with the wrong nothing. */
  checkingCatalog: boolean;
}

export function StockListEmpty(props: EmptyProps) {
  const { ctx, search, locationId, locationName, level, narrowed, catalogMatches } = props;
  const { checkingCatalog } = props;

  // Good news needs EVIDENCE. A location nobody has counted anything into is
  // not running low and has not run out, and saying so reads as reassurance
  // about a shelf that is simply empty — so the claim waits on a scope that
  // holds something, and falls through to "nothing matches that" when it does
  // not. Asked only here, where the answer changes the sentence.
  const goodNewsCandidate = level !== '' && search.trim() === '';
  const scope = useScopeHasStock(locationId, goodNewsCandidate);
  const scopeHasStock = (scope.data?.total ?? 0) > 0;

  if (goodNewsCandidate && scope.isFetching) {
    return <PaneWaiting label="Checking your stock…" />;
  }

  if (level === 'out' && goodNewsCandidate && scopeHasStock) {
    return (
      <EmptyState
        icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
        title={
          locationName
            ? `Everything has some to sell at ${locationName}`
            : 'Everything has some to sell'
        }
        description="Nothing you are counting has run out. Everything a customer can see is something they can actually buy. Choose All to see the rest of your stock."
      />
    );
  }

  if (level === 'low' && goodNewsCandidate && scopeHasStock) {
    return (
      <EmptyState
        icon={<Icon glyph={faArrowTrendDown} className="size-6" aria-hidden />}
        title={
          locationName ? `Nothing is running low at ${locationName}` : 'Nothing is running low'
        }
        description="Everything with a reorder rule is above the level you asked to be warned at. Choose All to see the rest of your stock."
      />
    );
  }

  // Answering "Nothing matches that" first and correcting it a beat later is
  // worse than a short wait: the first answer is the wrong one.
  if (checkingCatalog) {
    return <PaneWaiting label="Checking your catalog…" />;
  }

  if (catalogMatches.length > 0) {
    return <UncountedMatches ctx={ctx} search={search} matches={catalogMatches} />;
  }

  // With no stock in the scope at all, the state chip is not what emptied the
  // list, so it does not get to decide which nothing this is: a chosen location
  // says which one, and a shop that has counted nothing anywhere gets the two
  // ways to start.
  const reallyNarrowed = goodNewsCandidate && !scopeHasStock ? locationId !== '' : narrowed;

  if (reallyNarrowed) {
    return (
      <EmptyState
        icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
        title="Nothing matches that"
        description={emptyAdvice(search.trim(), locationName)}
      />
    );
  }

  return <NothingCountedYet ctx={ctx} />;
}

/** The search matched real products that have never been counted. Naming them,
 *  and offering the one action that helps, is the difference between a dead end
 *  and a next step. */
function UncountedMatches({
  ctx,
  search,
  matches,
}: {
  ctx: SurfaceContext;
  search: string;
  matches: CatalogMatch[];
}) {
  return (
    <EmptyState
      icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
      title={`Nothing counted for “${search.trim()}” yet`}
      description={
        matches.length === 1
          ? 'This is in your catalog and has never been counted, so your website sells it without limit. Open it to say how many you have.'
          : 'These are in your catalog and have never been counted, so your website sells them without limit. Open one to say how many you have.'
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {matches.map((match) => (
            <Button
              key={match.id}
              size="sm"
              color="module"
              onClick={(event) => {
                openProductFacet(ctx, 'commerce.product.stock', match.id, event);
              }}
            >
              {match.title}
            </Button>
          ))}
        </div>
      }
    />
  );
}

/** Nothing counted anywhere — a brand-new shop. The two real ways in, in the
 *  order they are useful: count the lot, or count one thing. */
function NothingCountedYet({ ctx }: { ctx: SurfaceContext }) {
  return (
    <EmptyState
      icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
      title="Nothing is being counted yet"
      description="Until you say how many of something you have, your website sells it without limit. Counting is how the numbers here start."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open('inventory.counts.list', {}, { target: 'tab' });
            }}
          >
            Count what you have
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="module"
            onClick={() => {
              // Opens in following mode and says how to choose a product, which
              // is the honest shape when no product is in hand.
              ctx.open('commerce.product.stock', {}, { target: 'beside' });
            }}
          >
            How many you have
          </Button>
        </div>
      }
    />
  );
}
