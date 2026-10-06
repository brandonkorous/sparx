'use client';

// The Recipe Gallery: the ~45 automations sparx pre-installs, grouped by what they ACHIEVE, each
// with a plain name and one big ON/OFF switch. It only presents and toggles existing rules; any
// rule the recipe catalog has not named yet lands in "More", so none is ever invisible here.

import { productCopy } from '../../lib/product';
import { Text } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { GalleryBody } from './recipe-gallery/gallery-body';
import { GalleryToolbar } from './recipe-gallery/gallery-toolbar';
import { useRecipeGallery } from './recipe-gallery/use-recipe-gallery';

const COLUMN = 'mx-auto flex w-full max-w-6xl flex-col gap-5 @lg:gap-6';

export function RecipeGallerySurface({ ctx }: { ctx: SurfaceContext }) {
  const gallery = useRecipeGallery();

  return (
    <div className={PANE_SHELL}>
      <GalleryToolbar gallery={gallery} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Text>
            {productCopy(
              'automations.recipes.intro',
              'These are automations Piggles has already set up for your business. Each one runs a job for you in the background: welcoming customers, chasing overdue invoices, following up on a sale. Flip one on to put it to work, and use “Customize” to change how it behaves.'
            )}
          </Text>

          <GalleryBody ctx={ctx} gallery={gallery} />
        </div>
      </div>
    </div>
  );
}
