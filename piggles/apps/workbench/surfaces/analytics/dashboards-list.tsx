'use client';

// The dashboard picker.
//
// It exists from day one (docs/129 §9): today it lists the built-in dashboards
// available to this tenant; when user-authored dashboards arrive it becomes the
// manager unchanged, because a dashboard is already an addressable entity opened
// by id. Each row wears its owning module's hue as a small signal — wayfinding,
// not decoration, so the tint rides the icon rather than washing the whole card.

import { Button, Card, EmptyState, Heading, Text } from '@wizeworks/silicaui-react';
import { LayoutDashboard, ServerCrash } from 'lucide-react';
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

function asModule(module: string): WorkbenchModule {
  return (WORKBENCH_MODULES as readonly string[]).includes(module)
    ? (module as WorkbenchModule)
    : 'platform';
}

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function DashboardRow({
  dashboard,
  onOpen,
}: {
  dashboard: DashboardSummary;
  onOpen: (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  return (
    <ModuleScope module={asModule(dashboard.module)}>
      <button
        type="button"
        className="hover:border-module w-full rounded-lg text-left transition-colors"
        onClick={(event) => onOpen(dashboard.id, event)}
      >
        <Card className="flex items-start gap-3 p-4">
          <LayoutDashboard className="text-module mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{dashboard.title}</span>
            <Text className="text-sm">{dashboard.description}</Text>
          </div>
        </Card>
      </button>
    </ModuleScope>
  );
}

export function DashboardsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const dashboards = useDashboards();

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('analytics.dashboard.view', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Dashboards">
        <LayoutDashboard className="size-4 shrink-0" aria-hidden />
        <Heading level={2} className="min-w-0 truncate text-base font-semibold">
          Dashboards
        </Heading>
        <div className="ml-auto">
          <RefreshButton
            isFetching={dashboards.isFetching}
            updatedAt={dashboards.data ? dashboards.dataUpdatedAt : undefined}
            onRefresh={() => void dashboards.refetch()}
          />
        </div>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {dashboards.isError ? (
            <EmptyState
              icon={<ServerCrash className="size-6" aria-hidden />}
              title="Could not load your dashboards"
              description={analyticsErrorMessage(
                dashboards.error,
                'This is a problem reaching the server. Try again in a moment.'
              )}
              actions={
                <Button size="sm" color="neutral" onClick={() => void dashboards.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : dashboards.isPending ? (
            <Text className="text-sm" role="status">
              Loading…
            </Text>
          ) : (dashboards.data ?? []).length === 0 ? (
            <EmptyState
              icon={<LayoutDashboard className="size-6" aria-hidden />}
              title="No dashboards yet"
              description={productCopy(
                'analytics.dashboards.firstRun',
                'Dashboards arrive with the apps you switch on — add My Site and its traffic dashboard turns up here, for example.'
              )}
            />
          ) : (
            <>
              <Text className="text-sm">
                Each dashboard answers one set of questions. Open one in a tab, Shift-click to place
                it alongside your work, or Alt-click to send it to another window.
              </Text>
              {(dashboards.data ?? []).map((dashboard) => (
                <DashboardRow key={dashboard.id} dashboard={dashboard} onOpen={open} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
