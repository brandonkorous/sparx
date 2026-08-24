'use client';

// Nothing to show, in the two senses that mean opposite things: a filter that
// matched nothing, and a shop with nothing in it yet.

import { Button } from '@wizeworks/silicaui-react';
import { faBox, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListEmptyState } from '../../components/list-empty-state';
import { MODULE, emptyAdvice, type Modifiers } from './products-list-shared';

export function ProductsListEmpty({
  narrowed,
  search,
  filterLabel,
  onCreate,
}: {
  narrowed: boolean;
  search: string;
  filterLabel: string | null;
  onCreate: (event: Modifiers) => void;
}) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={narrowed}
      noResults={{
        icon: <Icon glyph={faBox} className="size-6" aria-hidden />,
        title: 'No products match that',
        description: emptyAdvice(search, filterLabel),
      }}
      firstRun={{
        // "Catalog" is a third word for a thing this console already calls
        // two things — the app is Sell and the screen is Products — and it
        // is the one word of the three a person would not have used
        // themselves. The sentence under it already explains what a product
        // is, so the heading only has to name the emptiness.
        title: 'Nothing to sell yet',
        description:
          'A product is one thing you sell. Add your first one and it can be on your website within a minute.',
        actions: (
          <Button size="sm" color="module" onClick={onCreate}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add a product
          </Button>
        ),
      }}
    />
  );
}
