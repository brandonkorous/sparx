'use client';

// Paging, and the line telling you what the three modifiers do. The hint only
// appears where there is a pointer to use them with and something to click.

import { Text } from '@wizeworks/silicaui-react';
import { faTruck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE } from '../../components/list-pagination';
import { reorderHint } from './reorder-supplier-words';
import type { ReorderPane } from './reorder-window';

export function ReorderFooter({
  pane,
}: {
  pane: Pick<ReorderPane, 'w' | 'rows' | 'query' | 'selection'>;
}) {
  const { w, rows, query, selection } = pane;
  const { pageSize, take, page, setTake: onTake, setPage: onPage, setPageSize: onPageSize } = w;
  const shown = rows.length;
  const busy = query.isFetching;
  return (
    <div className="shrink-0">
      <ListPagination
        shown={shown}
        firstRow={shown === 0 ? 0 : w.skip + 1}
        total={query.data?.total}
        page={page}
        pageSize={pageSize}
        canLoadMore={take < MAX_TAKE}
        busy={busy}
        onLoadMore={() => {
          onTake((current) => Math.min(current + pageSize, MAX_TAKE));
        }}
        onPageChange={(next) => {
          onPage(next);
          // A jump REPLACES the window, so growth from "load more" belongs to
          // the window you just left, not the one you land on.
          onTake(() => pageSize);
        }}
        onPageSizeChange={(size) => {
          onPageSize(size);
          onPage(1);
          onTake(() => size);
        }}
      />
      {/* The opening clause used to appear whenever the list had rows, including
          on a page where not one tick box could be ticked — which is most pages
          on most accounts. A sentence telling somebody to do what the screen
          will not let them do is the same defect as one sending them somewhere
          with nothing there. */}
      {shown > 0 ? (
        <Text className="hidden px-1 pb-1 text-sm @xl:block">
          <Icon glyph={faTruck} className="mr-1 inline size-4 align-text-bottom" aria-hidden />
          {reorderHint(selection.selectable.length)}
        </Text>
      ) : null}
    </div>
  );
}
