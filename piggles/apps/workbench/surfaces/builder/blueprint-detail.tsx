'use client';

// One ready-made design — preview it, then add it to a site.
//
// Every action pivots on WHICH SITE, so the picker and the actions live together
// in blueprint-detail-target, and what is known about that site in
// blueprint-detail-state.
//
// A design is a WHOLE SITE. It stamps as drafts, so nothing is live until it is
// published — but adding one to a site that has pages REPLACES them, along with
// its header, footer and look, and that cannot be undone. This file used to say
// the opposite ("adding is additive… leaves your pages alone"), and so did the
// pane; `installImpact` in blueprints-words is where the true sentence lives now.
// Products, articles, customers and orders really are untouched — only the site
// itself is swapped. The examples are still a choice rather than a given
// (issue 098).

import { useEffect, useState } from 'react';
import { Card, Text } from '@wizeworks/silicaui-react';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useBlueprint, type Blueprint } from './blueprints-data';
import { contentsGroups } from './blueprints-words';
import { useBlueprintActions } from './blueprint-detail-actions';
import { useBlueprintTarget } from './blueprint-detail-state';
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
  const target = useBlueprintTarget(blueprint);
  const {
    targetSite,
    targetName,
    targetPageCount,
    newSite,
    current,
    updateAvailable,
    plan,
    installsFetching,
    refetchInstalls,
  } = target;

  // Seeding is on purpose, so the examples come by default. Turning them off is
  // the deliberate act, not the other way round.
  const [sampleData, setSampleData] = useState(true);

  const actions = useBlueprintActions({
    blueprint,
    targetSite,
    targetName,
    targetPageCount,
    newSite,
    current,
    plan,
    refetchInstalls,
  });

  return (
    <div className={PANE_SHELL}>
      <BlueprintToolbar
        status={target.status}
        updateAvailable={updateAvailable}
        isFetching={isFetching || installsFetching}
        updatedAt={dataUpdatedAt}
        onRefresh={() => {
          refetch();
          refetchInstalls();
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

          <BlueprintContentsSection blueprint={blueprint} offModules={target.offModules} />

          <BlueprintTargetSection
            blueprint={blueprint}
            sites={target.siteItems}
            sitesLoaded={target.sitesLoaded}
            targetSite={targetSite}
            targetName={targetName}
            targetPageCount={targetPageCount}
            newSite={newSite}
            onSite={target.chooseSite}
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
