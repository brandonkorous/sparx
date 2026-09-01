'use client';

// What the detail pane KNOWS about the site it is pointed at.
//
// Split from blueprint-detail under RULE #0.5: that file draws the pane, and this
// works out the facts every part of it depends on — which site, what is already
// on it, whether this design is in it, whether a newer version exists, and which
// of the design's apps are switched off.
//
// They belong apart because every one of these facts pivots on ONE choice (the
// target site) and several are derived from each other. Read together they are a
// paragraph; scattered through JSX they were a file where changing the target
// meant touching six places.

import { useMemo, useState } from 'react';

import { useActivePropertyId, useModuleStates } from '../../lib/api/shell-data';
import { useSites } from '../sites/data';
import { useBlueprintInstalls, type Blueprint, type BlueprintInstall } from './blueprints-data';
import { useUpdatePlan, type UpdatePlan } from './blueprints-update';
import { installState } from './blueprints-words';
import { NEW_SITE, useNewSiteTarget, type NewSiteTarget } from './blueprint-new-site';

export interface BlueprintTarget {
  /** Site id → name, for the picker. */
  siteItems: Record<string, string>;
  sitesLoaded: boolean;
  targetSite: string;
  targetName: string;
  /** Pages already on that site — what an install would replace. Undefined until
   *  the sites list lands, which the impact wording handles without guessing. */
  targetPageCount: number | undefined;
  chooseSite: (id: string) => void;
  /** This design's install in the chosen site, if it has one. */
  current: BlueprintInstall | undefined;
  status: ReturnType<typeof installState> | null;
  updateAvailable: boolean;
  plan: UpdatePlan | undefined;
  /** Required apps this business has switched off, so the pane can say what the
   *  install will skip — mirroring the installer, which only fills in apps that
   *  are on. */
  offModules: string[];
  /** The target that does not exist yet — name, address and the create call.
   *  A design replaces the site it lands in, so this is how somebody tries one
   *  without losing the site they have ([363]). */
  newSite: NewSiteTarget;
  installsFetching: boolean;
  refetchInstalls: () => void;
}

export function useBlueprintTarget(blueprint: Blueprint): BlueprintTarget {
  const { data: sites } = useSites();
  const activeSiteId = useActivePropertyId();
  const { data: modules } = useModuleStates();
  const {
    data: installs,
    isFetching: installsFetching,
    refetch: refetchInstalls,
  } = useBlueprintInstalls();

  // Default the target to the site being worked in — nearly always the one meant
  // — but keep it a visible, changeable choice, because adding a whole design to
  // the wrong site is a real mistake to make.
  const [chosen, setChosen] = useState('');
  const targetSite = chosen || (activeSiteId ?? '');

  const newSite = useNewSiteTarget(targetSite, setChosen);

  // The new-site row is LAST: the real sites are what she is usually choosing
  // between, and an option that creates something belongs after the ones that
  // only select.
  const siteItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const site of sites ?? []) items[site.id] = site.name;
    items[NEW_SITE] = 'A new site';
    return items;
  }, [sites]);

  // The count comes off the same list the picker is built from, so the name and
  // the number can never describe two different sites. A site that does not
  // exist yet has no pages, and that is a fact rather than a default — it is why
  // the option is there.
  const targetPageCount =
    targetSite === NEW_SITE ? 0 : (sites ?? []).find((site) => site.id === targetSite)?.pageCount;

  // The catalog list only knows the ACTIVE site's install state; this is what
  // lets the pane speak truthfully about whichever site is pointed at.
  // A site that does not exist cannot have an install, so the whole
  // installed/publish/remove half of the pane stays away until it does.
  const current = useMemo(
    () =>
      targetSite === NEW_SITE
        ? undefined
        : (installs ?? []).find(
            (row) => row.blueprint_key === blueprint.key && row.property_id === targetSite
          ),
    [installs, blueprint.key, targetSite]
  );

  // An update is available when the chosen site's install trails the catalog
  // version and is in a state that can take one (a draft or a live install — not
  // one that is mid-install or stopped, which resolve their own way first).
  const updateAvailable =
    !!current &&
    (current.status === 'installed' || current.status === 'live') &&
    current.blueprint_version !== blueprint.version;
  const { data: plan } = useUpdatePlan(current?.id ?? '', updateAvailable);

  const offModules = useMemo(() => {
    const on = new Map<string, boolean>();
    for (const module of modules ?? []) on.set(module.slug, module.enabled);
    return blueprint.requiredModules.filter((slug) => on.get(slug) === false);
  }, [modules, blueprint.requiredModules]);

  return {
    siteItems,
    sitesLoaded: (sites ?? []).length > 0,
    targetSite,
    targetName: targetSite === NEW_SITE ? newSite.label : (siteItems[targetSite] ?? 'this site'),
    targetPageCount,
    chooseSite: setChosen,
    current,
    status: current ? installState(current.status) : null,
    updateAvailable,
    plan,
    offModules,
    newSite,
    installsFetching,
    refetchInstalls: () => {
      void refetchInstalls();
    },
  };
}
