'use client';

// Delete a page, having first said what it costs.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useDeletePage, type PageSummary } from '../../lib/studio/page-data';
import { addressPeers } from './page-address';
import { deletePageCost } from './page-delete-words';

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
      description: deletePageCost(page, addressPeers(page, pages)),
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
