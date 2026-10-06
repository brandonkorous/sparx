'use client';

import { SearchInput, Select } from '@wizeworks/silicaui-react';
import { RefreshButton } from '../../../components/refresh-button';
import { PaneToolbar } from '../../../components/pane-toolbar';
import type { RecipeGallery } from './use-recipe-gallery';

function StateFilter({ gallery }: { gallery: RecipeGallery }) {
  const { state, setState } = gallery;
  return (
    <div className="ml-auto w-40 shrink-0">
      <Select
        size="sm"
        aria-label="Show"
        value={state}
        items={{
          all: 'All recipes',
          on: 'On',
          off: 'Off',
          error: 'Needs attention',
        }}
        onValueChange={(next) => {
          setState((next as string) || 'all');
        }}
      />
    </div>
  );
}

export function GalleryToolbar({ gallery }: { gallery: RecipeGallery }) {
  const { search, setSearch, joined, onCount, isPending, isError } = gallery;
  const { isFetching, data, dataUpdatedAt, refetch } = gallery;
  return (
    <PaneToolbar
      label="Ready-made automations controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search recipes"
            placeholder="Search recipes…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      }
      status={
        <p className="hidden shrink-0 text-sm whitespace-nowrap @xl:block">
          {joined.length > 0 ? `${String(onCount)} of ${String(joined.length)} on` : ''}
        </p>
      }
      statusReady={!isPending}
      statusFailed={isError}
      controls={<StateFilter gallery={gallery} />}
      refresh={
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      }
    />
  );
}
