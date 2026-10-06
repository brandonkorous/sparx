'use client';

import { productCopy } from '../../../lib/product';
import { PaneWaiting } from '../../../components/pane-waiting';
import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { faSparkles } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { goalGroup } from '../recipes-catalog';
import { targetFor } from '../target-for';
import { RecipeCard } from './recipe-card';
import type { RecipeGallery } from './use-recipe-gallery';

function GalleryEmpty({ gallery }: { gallery: RecipeGallery }) {
  const { filtering, setSearch, setState } = gallery;
  return filtering ? (
    <EmptyState
      icon={<Icon glyph={faSparkles} className="size-6" aria-hidden />}
      title="No recipes match that"
      description={productCopy(
        'automations.recipes.noResults',
        'Try a different word, or set the filter back to “All recipes” to see everything Piggles set up for you.'
      )}
      actions={
        <Button
          size="sm"
          variant="soft"
          color="module"
          onClick={() => {
            setSearch('');
            setState('all');
          }}
        >
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<Icon glyph={faSparkles} className="size-6" aria-hidden />}
      title="No recipes yet"
      description={productCopy(
        'automations.recipes.firstRun',
        'Recipes appear here as you add apps. Add Sell, Invoices or Messages and their ready-made automations turn up ready to use.'
      )}
    />
  );
}

function GoalSection({
  ctx,
  section: { group, items },
}: {
  ctx: SurfaceContext;
  section: RecipeGallery['grouped'][number];
}) {
  const GroupIcon = goalGroup(group.key).icon;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Icon glyph={GroupIcon} className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <p className="text-base">{group.blurb}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
        {items.map(({ automation, meta }) => (
          <RecipeCard
            key={automation.id}
            automation={automation}
            meta={meta}
            onCustomize={(event) => {
              ctx.open('automations.detail', { id: automation.id }, { target: targetFor(event) });
            }}
          />
        ))}
      </div>
    </section>
  );
}

export function GalleryBody({ ctx, gallery }: { ctx: SurfaceContext; gallery: RecipeGallery }) {
  const { isError, isPending, grouped, refetch } = gallery;
  return isError ? (
    <EmptyState
      icon={<Icon glyph={faSparkles} className="size-6" aria-hidden />}
      title="Could not load your recipes"
      description="Something went wrong reaching the server. Whatever you have switched on is unaffected and still running. Try again in a moment."
      actions={
        <Button
          size="sm"
          color="module"
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </Button>
      }
    />
  ) : isPending ? (
    <PaneWaiting label="Loading recipes…" />
  ) : grouped.length === 0 ? (
    <GalleryEmpty gallery={gallery} />
  ) : (
    grouped.map((section) => <GoalSection key={section.group.key} ctx={ctx} section={section} />)
  );
}
