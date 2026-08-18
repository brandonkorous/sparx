'use client';

// The brand board — every part of the theme, on one scrolling surface.
//
// It is a single island, so ONE stylesheet paints all of it and a token change
// lands everywhere at once. The island is also the CONTAINER every tile measures
// against — this lives in a dockable pane, where the viewport says nothing at all
// about how wide the column really is.

import { useStudioHost } from '../../context';
import { ThemeIsland } from '../island';
import type { ThemeMode } from '../edit-context';
import { PageTile } from './page';
import { PaletteTile } from './palette';
import { WordsTile } from './words';
import { SurfacesTile } from './surfaces';
import { ButtonsTile } from './buttons';
import { BadgesTile } from './badges';
import { FormsTile } from './forms';
import { MessagesTile } from './messages';
import { ProgressTile } from './progress';
import { NavigationTile } from './navigation';
import { DataTile } from './data';
import { SellingTile } from './selling';

export function ThemeBoard({ mode, name }: { mode: ThemeMode; name: string }) {
  // The BUSINESS, not the look's name. A heading reading "workshop" over a preview
  // of Wildroot Flowers reads as the site being wrong, and the look is already
  // named twice over — on the pane's tab and in the field that edits it.
  const site = useStudioHost().siteName?.trim();

  return (
    <ThemeIsland mode={mode} className="@container h-full min-h-0 overflow-auto">
      <div className="bg-base-200 min-h-full p-5" id="board-sample">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">{site && site.length > 0 ? site : 'Your site'}</h2>
          <p className="text-base">
            Wearing <strong>{name}</strong>. Change anything on the left and every panel below
            repaints as you do it.
          </p>
        </div>

        <div className="grid gap-5 @3xl:grid-cols-2 @6xl:grid-cols-3">
          <PageTile />
          <PaletteTile />
          <WordsTile />
          <SurfacesTile />
          <ButtonsTile />
          <BadgesTile />
          <FormsTile />
          <MessagesTile />
          <ProgressTile />
          <NavigationTile />
          <DataTile />
          <SellingTile />
        </div>
      </div>
    </ThemeIsland>
  );
}
