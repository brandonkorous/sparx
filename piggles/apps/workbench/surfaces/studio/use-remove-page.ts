'use client';

// Delete a page, having first said what it costs.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useDeletePage, type PageSummary } from '../../lib/studio/page-data';
import { addressPeers, isTemplate, routeOf } from './page-address';

/**
 * What deleting this page costs, in the order it matters: what it takes with it,
 * who else claims its address, and whether anyone outside the business will notice.
 */
function cost(page: PageSummary, peers: readonly string[]): string {
  const home = routeOf(page) === '/';
  const names = peers.join(' and ');
  const one = peers.length === 1;
  const lines: string[] = [];

  if (isTemplate(page)) {
    lines.push(
      'This is the page every one of those records is shown through, so deleting it leaves them with no page at all.'
    );
  } else if (peers.length > 0) {
    // The reason somebody is usually here: two pages claim one address and the
    // site check told them to pick. Naming the SURVIVOR is the whole answer.
    lines.push(
      home
        ? `${names} ${one ? 'is' : 'are'} also set to be your home page, and will have it to ${one ? 'itself' : 'themselves'}.`
        : `${names} also answer${one ? 's' : ''} to ${routeOf(page)}, and will have it to ${one ? 'itself' : 'themselves'}.`
    );
  } else {
    lines.push(
      home
        ? 'It is the only page set to be your home page, so your site will not have one until you clear another page’s address.'
        : `Nothing else answers to ${routeOf(page)}, so that address stops working.`
    );
  }

  lines.push(
    page.published
      ? 'It is live right now — anyone who follows a link to it, or finds it in Google, will get a not-found page straight away.'
      : 'It has never been live, so nobody outside your business has seen it.'
  );
  lines.push('There is no undo — the page and everything on it go for good.');
  return lines.join(' ');
}

export function useRemovePage(
  page: PageSummary,
  pages: readonly PageSummary[]
): { remove: () => Promise<void>; removing: boolean } {
  const confirm = useConfirm();
  const toast = useToast();
  const deletePage = useDeletePage();

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${page.name}”?`,
      description: cost(page, addressPeers(page, pages)),
      confirmLabel: 'Delete page',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    await deletePage.mutateAsync(page.id);
    toast.add({ title: `“${page.name}” deleted`, type: 'success' });
  };

  return { remove, removing: deletePage.isPending };
}
