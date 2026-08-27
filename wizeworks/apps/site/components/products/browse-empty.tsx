// What a listing says when it has nothing to show.
//
// TWO answers, because there are two situations and the advice for one is useless
// in the other. A visitor who narrowed the catalog and found nothing should widen
// it; a visitor standing in a part of the shop that is simply empty has nothing to
// widen, and telling them to "try adjusting your filters" sends them looking for a
// control they never touched.
//
// Juniper Row is the case. Eighteen category pages, every one empty — the only
// products ever filed in them were the blueprint's samples and she deleted those —
// each answering 200 with a heading, a breadcrumb, and "No products found. Try
// adjusting your filters or search" over a panel with nothing selected (issue 275).

import { EmptyState } from '@/components/empty-state';

export interface BrowseEmptyProps {
  /** Whether the VISITOR narrowed anything: a search term, a facet, a price, stock,
   *  a fitment selection. The collection or category a page is scoped to does not
   *  count — that is the page they opened, not a choice they can undo. */
  narrowed: boolean;
  /** Where "show me everything here" goes — this listing with no filters on it. */
  basePath: string;
  /** What this listing is a listing OF, for the un-narrowed sentence. */
  scope: 'catalog' | 'collection' | 'category';
}

const NOTHING_HERE: Record<BrowseEmptyProps['scope'], { title: string; description: string }> = {
  catalog: {
    title: 'Nothing in the shop yet',
    description: 'There is nothing on sale here at the moment. Do come back.',
  },
  collection: {
    title: 'Nothing in this collection yet',
    description: 'This collection is empty at the moment. There is more in the shop.',
  },
  category: {
    title: 'Nothing here yet',
    description: 'This part of the shop is empty at the moment. There is more in the shop.',
  },
};

export function BrowseEmpty({ narrowed, basePath, scope }: BrowseEmptyProps) {
  if (narrowed) {
    return (
      <EmptyState
        icon="🔍"
        title="Nothing matched"
        description="Nothing here fits what you asked for. Try removing one of your choices."
        action={{ label: 'Clear and show everything', href: basePath }}
      />
    );
  }
  const { title, description } = NOTHING_HERE[scope];
  return (
    <EmptyState
      title={title}
      description={description}
      {...(scope === 'catalog' ? {} : { action: { label: 'Browse the shop', href: '/products' } })}
    />
  );
}
