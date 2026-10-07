'use client';

// Where a file is used, by name, each with a way to open it (issue 932).
//
// The count says "2 product photos and 1 site page". Somebody about to delete or
// replace the file has to open each one, and this pane told her how many and
// left her to find them (its gap since act 116).
//
// A page belongs to ONE site. Opened while she stands in another, its id resolves
// to nothing and the editor says "This page isn't here any more" about a page that
// is one site over. So a page elsewhere switches site first, asking before it
// throws away unsaved work, exactly as Where it's used on a saved piece does.

import { buildPath } from '@wizeworks/links';
import { useConfirm } from '../../lib/confirm';
import { switchSite, useActivePropertyId, useSites } from '../../lib/api/shell-data';
import { useWorkbench } from '../../lib/workbench/context';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { isElsewhere, switchAsk } from '../builder/saved-piece-usage-words';
import { placeLabel, placeTarget, type UsePlace } from './media-admin';

export function MediaUsedBy({ ctx, places }: { ctx: SurfaceContext; places: UsePlace[] }) {
  const confirm = useConfirm();
  const { controller } = useWorkbench();
  const activeSiteId = useActivePropertyId();
  const { data: sites } = useSites();

  if (places.length === 0) return null;

  const open = async (place: UsePlace) => {
    const target = placeTarget(place);
    if (!target) return;
    const onSite =
      place.siteId && place.site
        ? { id: place.id, name: place.name, siteId: place.siteId, siteName: place.site }
        : null;
    if (!onSite || !isElsewhere(onSite, activeSiteId)) {
      ctx.open(target.surface, target.params, { target: 'beside' });
      return;
    }
    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        ...switchAsk(onSite),
        confirmLabel: 'Switch and open',
        cancelLabel: 'Stay here',
        color: 'danger',
      });
      if (!ok) return;
    }
    const slug = sites?.find((site) => site.id === onSite.siteId)?.slug;
    const address =
      buildPath(target.surface, target.params, slug ? { site: slug } : undefined) ?? undefined;
    await switchSite(
      controller,
      activeSiteId ?? 'default',
      onSite.siteId,
      address ? { address } : {}
    );
  };

  return (
    <div className="border-base-300 flex flex-col gap-1 border-b py-2">
      <p className="text-sm font-medium">Where it is used</p>
      <ul className="flex flex-col gap-1">
        {places.map((place) => (
          <li key={`${place.kind}:${place.id}`} className="text-sm">
            {placeTarget(place) ? (
              <button
                type="button"
                className="link text-left"
                onClick={() => {
                  void open(place);
                }}
              >
                {placeLabel(place)}
              </button>
            ) : (
              placeLabel(place)
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
