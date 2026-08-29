'use client';

// One ready-made design — preview it, then add it to a site.
//
// Every action pivots on WHICH SITE, so the picker and the actions live together
// in blueprint-detail-target. Adding is additive: it stamps a design as DRAFTS
// and leaves your pages and products alone. What it does NOT leave alone is your
// console, which is why the examples are a choice rather than a given (issue 098).

import { useEffect, useMemo, useState } from 'react';
import { Card, Text } from '@wizeworks/silicaui-react';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useActivePropertyId, useModuleStates } from '../../lib/api/shell-data';
import { useSites } from '../sites/data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  useBlueprint,
  useBlueprintInstalls,
  type Blueprint,
  type BlueprintInstall,
} from './blueprints-data';
import { useUpdatePlan } from './blueprints-update';
import { contentsGroups, installState } from './blueprints-words';
import { useBlueprintActions } from './blueprint-detail-actions';
import {
  BlueprintContentsSection,
  BlueprintPreview,
  BlueprintToolbar,
  InstallStatusAlert,
  UpdateAlert,
} from './blueprint-detail-parts';
import { BlueprintTargetSection } from './blueprint-detail-target';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function BlueprintDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const key = typeof ctx.params.key === 'string' ? ctx.params.key : '';
  const {
    data: blueprint,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useBlueprint(key);

  useEffect(() => {
    if (blueprint) ctx.setTitle(blueprint.name);
  }, [ctx, blueprint]);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="design"
            title="Could not load this design"
            description="This is a problem reaching the server, or the design is no longer in the catalog. Your site is unaffected."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !blueprint) return <PaneWaiting />;

  return (
    <BlueprintBody
      blueprint={blueprint}
      isFetching={isFetching}
      dataUpdatedAt={dataUpdatedAt}
      refetch={() => {
        void refetch();
      }}
    />
  );
}

function BlueprintBody({
  blueprint,
  isFetching,
  dataUpdatedAt,
  refetch,
}: {
  blueprint: Blueprint;
  isFetching: boolean;
  dataUpdatedAt: number;
  refetch: () => void;
}) {
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

  // Seeding is on purpose, so the examples come by default. Turning them off is
  // the deliberate act, not the other way round.
  const [sampleData, setSampleData] = useState(true);

  const siteItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const site of sites ?? []) items[site.id] = site.name;
    return items;
  }, [sites]);
  const targetName = siteItems[targetSite] ?? 'this site';

  // The install row (if any) for THIS blueprint in the chosen site. The catalog
  // list only knows the active site's state; this is what lets the pane speak
  // truthfully about whichever site the operator points at.
  const current: BlueprintInstall | undefined = useMemo(
    () =>
      (installs ?? []).find(
        (row) => row.blueprint_key === blueprint.key && row.property_id === targetSite
      ),
    [installs, blueprint.key, targetSite]
  );
  const state = current ? installState(current.status) : null;

  // An update is available when the chosen site's install trails the catalog
  // version and is in a state that can take one (a draft or a live install — not
  // one that is mid-install or stopped, which resolve their own way first).
  const updateAvailable =
    !!current &&
    (current.status === 'installed' || current.status === 'live') &&
    current.blueprint_version !== blueprint.version;
  const { data: plan } = useUpdatePlan(current?.id ?? '', updateAvailable);

  const actions = useBlueprintActions({
    blueprint,
    targetSite,
    targetName,
    current,
    plan,
    refetchInstalls: () => {
      void refetchInstalls();
    },
  });

  // Which required modules are off, so the note can say what will be skipped —
  // mirroring the installer, which only fills in modules the tenant has enabled.
  const offModules = useMemo(() => {
    const on = new Map<string, boolean>();
    for (const module of modules ?? []) on.set(module.slug, module.enabled);
    return blueprint.requiredModules.filter((slug) => on.get(slug) === false);
  }, [modules, blueprint.requiredModules]);

  return (
    <div className={PANE_SHELL}>
      <BlueprintToolbar
        status={state}
        updateAvailable={updateAvailable}
        isFetching={isFetching || installsFetching}
        updatedAt={dataUpdatedAt}
        onRefresh={() => {
          refetch();
          void refetchInstalls();
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Text className="text-sm">
            {[
              blueprint.vertical ? verticalText(blueprint.vertical) : null,
              `Version ${blueprint.version}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>

          <BlueprintPreview blueprint={blueprint} />

          {blueprint.summary ? <Text>{blueprint.summary}</Text> : null}

          {current ? <InstallStatusAlert install={current} targetName={targetName} /> : null}

          {/* A newer version is in the catalog. Its own prompt, not folded into the
              status line, because it is an ACTION rather than a state. */}
          {updateAvailable && current ? (
            <UpdateAlert
              blueprint={blueprint}
              install={current}
              plan={plan}
              pending={actions.update.isPending}
              disabled={actions.busy && !actions.update.isPending}
              onUpdate={() => {
                void actions.onUpdate();
              }}
            />
          ) : null}

          <BlueprintContentsSection blueprint={blueprint} offModules={offModules} />

          <BlueprintTargetSection
            blueprint={blueprint}
            sites={siteItems}
            sitesLoaded={(sites ?? []).length > 0}
            targetSite={targetSite}
            targetName={targetName}
            onSite={setChosen}
            hasExamples={contentsGroups(blueprint.contents).examples.length > 0}
            sampleData={sampleData}
            onSampleData={setSampleData}
            current={current}
            busy={actions.busy}
            installing={actions.install.isPending}
            publishing={actions.goLive.isPending}
            removing={actions.uninstall.isPending}
            onInstall={() => {
              void actions.onInstall(sampleData);
            }}
            onGoLive={() => {
              void actions.onGoLive();
            }}
            onRemove={() => {
              void actions.onRemove();
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Title-cased vertical for the identity line. Plain text, not a badge. */
function verticalText(vertical: string): string {
  return vertical
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
