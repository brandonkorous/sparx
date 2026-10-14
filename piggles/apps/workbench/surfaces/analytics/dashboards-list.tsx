'use client';

// The dashboard picker (docs/129 §9). It lists the built-in dashboards today and
// becomes the manager for authored ones unchanged, since a dashboard is opened by id.
// Each row's module hue rides its icon: wayfinding, not a wash over the card.

import { Card, Text } from '@wizeworks/silicaui-react';
import { faGauge } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { RowOpenHint } from '../../components/row-open-hint';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import {
  ModuleScope,
  WORKBENCH_MODULES,
  type WorkbenchModule,
} from '../../components/module-scope';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { analyticsErrorMessage, useDashboards, type DashboardSummary } from './data';
import { productCopy } from '../../lib/product';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
type DashboardsQuery = ReturnType<typeof useDashboards>;

function asModule(module: string): WorkbenchModule {
  return (WORKBENCH_MODULES as readonly string[]).includes(module)
    ? (module as WorkbenchModule)
    : 'platform';
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function DashboardRow({
  dashboard,
  onOpen,
}: {
  dashboard: DashboardSummary;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  return (
    <ModuleScope module={asModule(dashboard.module)}>
      <button
        type="button"
        className="hover:border-module w-full rounded-lg text-left transition-colors"
        onClick={(event) => onOpen(dashboard.id, event)}
      >
        <Card className="flex items-start gap-3 p-4">
          <Icon glyph={faGauge} className="text-module mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{dashboard.title}</span>
            <Text className="text-sm">{dashboard.description}</Text>
          </div>
        </Card>
      </button>
    </ModuleScope>
  );
}

const MODULE = 'platform';

function countWords(count: number): string {
  if (count === 0) return 'No dashboards yet';
  return count === 1 ? '1 dashboard' : `${String(count)} dashboards`;
}

function DashboardsToolbar({ dashboards }: { dashboards: DashboardsQuery }) {
  const rows = dashboards.data ?? [];
  return (
    <PaneToolbar
      label="Dashboards"
      status={
        <>
          <Icon glyph={faGauge} className="size-4 shrink-0" aria-hidden />
          <Text as="span" className="text-sm">
            {countWords(rows.length)}
          </Text>
        </>
      }
      statusReady={!dashboards.isPending}
      statusFailed={dashboards.isError}
      refresh={
        <div className="ml-auto">
          <RefreshButton
            isFetching={dashboards.isFetching}
            updatedAt={dashboards.data ? dashboards.dataUpdatedAt : undefined}
            onRefresh={() => void dashboards.refetch()}
          />
        </div>
      }
    />
  );
}

function DashboardsBody({
  dashboards,
  onOpen,
}: {
  dashboards: DashboardsQuery;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const rows = dashboards.data ?? [];
  if (dashboards.isError) {
    return (
      <PaneLoadError
        module={MODULE}
        icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
        title="Could not load your dashboards"
        description={analyticsErrorMessage(
          dashboards.error,
          'This is a problem reaching the server. Nothing you are looking at is affected. It just could not be read.'
        )}
        error={dashboards.error}
        onRetry={() => void dashboards.refetch()}
      />
    );
  }
  if (dashboards.isPending) return <PaneWaiting module={MODULE} />;
  if (rows.length === 0) {
    return (
      <PaneEmpty
        module={MODULE}
        icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
        title="No dashboards yet"
        description={productCopy(
          'analytics.dashboards.firstRun',
          'Dashboards arrive with the apps you switch on. Add My Site and its traffic dashboard turns up here, for example.'
        )}
      />
    );
  }
  return (
    <>
      <Text className="text-sm">Each dashboard answers one set of questions.</Text>
      {rows.map((dashboard) => (
        <DashboardRow key={dashboard.id} dashboard={dashboard} onOpen={onOpen} />
      ))}
      {/* One shared hint, not a per-surface sentence: shift and alt do not exist
          on the phone the compact console was built for. */}
      {rows.length > 0 ? <RowOpenHint what="a dashboard to open it" /> : null}
    </>
  );
}

export function DashboardsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const dashboards = useDashboards();

  const open = (id: string, event: OpenEvent) => {
    ctx.open('analytics.dashboard.view', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <DashboardsToolbar dashboards={dashboards} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <DashboardsBody dashboards={dashboards} onOpen={open} />
        </div>
      </div>
    </div>
  );
}
