'use client';

// Looks other people made.
//
// Third shelf in the dialog, under the business's own and the ready-made ones, and
// in that order on purpose: what you already have, then what came with the product,
// then what you could go and get. A shelf of other people's work at the top would
// make the looks you already made feel like the afterthought.
//
// Installing COPIES, exactly as picking a ready-made one does — the difference is
// only where it came from, which is recorded on the row so "there is a newer version
// of this" stays answerable later.

import { Badge, Button, useToast } from '@wizeworks/silicaui-react';
import { buildSilicaThemeCssFromTheme } from '@wizeworks/site-themes';
import {
  lookAsTheme,
  useInstallLook,
  useMarketplaceLooks,
  type MarketplaceLook,
} from '../../lib/studio/marketplace-data';

/** A slug safe to put in a CSS attribute selector. */
function lookKey(slug: string): string {
  return `market-${slug}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** What a look costs, in words rather than in cents. */
function priceOf(look: MarketplaceLook): string | null {
  if (look.price.cents === 0) return null;
  return `$${(look.price.cents / 100).toFixed(2)}`;
}

export function ThemeMarket({ onInstalled }: { onInstalled: (id: string) => void }) {
  const looks = useMarketplaceLooks();
  const install = useInstallLook();
  const toast = useToast();

  const rows = looks.data ?? [];
  if (looks.isPending || rows.length === 0) return null;

  const take = async (look: MarketplaceLook) => {
    try {
      const made = await install.mutateAsync(look);
      toast.add({ title: `“${made.name}” is yours now`, type: 'success' });
      onInstalled(made.id);
    } catch {
      toast.add({ title: 'That look could not be added', type: 'error' });
    }
  };

  return (
    <section className="mt-6">
      <h3 className="text-base-content text-sm font-medium">From other people</h3>
      <p className="text-base-content mb-2 text-sm">
        Add one and it becomes yours — a copy you can change, which nobody else can alter
        afterwards.
      </p>
      {/* One stylesheet for the shelf, scoped per look, so each swatch means THAT
          look's colors. No inline style and no runtime-computed class name. */}
      <style>
        {rows
          .map((look) =>
            buildSilicaThemeCssFromTheme(lookAsTheme(look), {
              rootSelector: `[data-look="${lookKey(look.slug)}"]`,
            })
          )
          .join('')}
      </style>
      <ul className="flex max-h-72 flex-col gap-1 overflow-auto">
        {rows.map((look) => (
          <LookRow
            key={look.id}
            look={look}
            busy={install.isPending}
            onTake={() => void take(look)}
          />
        ))}
      </ul>
    </section>
  );
}

function LookRow({
  look,
  busy,
  onTake,
}: {
  look: MarketplaceLook;
  busy: boolean;
  onTake: () => void;
}) {
  const price = priceOf(look);
  return (
    <li className="hover:bg-base-200 flex items-center gap-2 rounded px-2 py-1.5">
      <span data-look={lookKey(look.slug)} className="inline-flex shrink-0 gap-0.5" aria-hidden>
        <span className="bg-primary border-base-300 inline-block size-2.5 rounded-full border" />
        <span className="bg-secondary border-base-300 inline-block size-2.5 rounded-full border" />
        <span className="bg-accent border-base-300 inline-block size-2.5 rounded-full border" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-base-content block truncate text-sm">{look.name}</span>
        <span className="text-base-content block truncate text-sm">
          {look.publisher.displayName}
          {look.tagline ? ` — ${look.tagline}` : ''}
        </span>
      </span>
      {look.publisher.verified ? (
        <Badge color="info" variant="soft" size="sm">
          Checked by us
        </Badge>
      ) : null}
      {price ? (
        <Badge color="warning" variant="soft" size="sm">
          {price}
        </Badge>
      ) : null}
      <Button size="sm" color="primary" variant="soft" disabled={busy} onClick={onTake}>
        Add it
      </Button>
    </li>
  );
}
