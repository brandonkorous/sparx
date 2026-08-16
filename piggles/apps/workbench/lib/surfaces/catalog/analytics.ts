// Analytics — dashboards that read across the modules you have on.
//
// Two surfaces (docs/129 §9): the picker (`analytics.dashboards.list`) and the
// generic viewer (`analytics.dashboard.view`), which renders any dashboard by id.
// Both are registered under the `platform` module because a dashboard belongs to
// no single business module — the viewer re-scopes to the OWNING module's hue
// once a dashboard loads (a Traffic dashboard is a builder screen). The ids are
// the ones the design doc names, so saved layouts and deep links are stable from
// the first commit.

import { faGauge } from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
import { DashboardsListSurface } from '../../../surfaces/analytics/dashboards-list';
import { DashboardViewSurface } from '../../../surfaces/analytics/dashboard-view';

export const ANALYTICS_SURFACES: SurfaceDefinition[] = [
  {
    // A sectionless platform landing, like Start here and Pulse — the account's
    // dashboards, not one of the settings groups. Sits just under Pulse.
    key: 'analytics.dashboards.list',
    title: 'Dashboards',
    module: 'platform',
    icon: faGauge,
    component: DashboardsListSurface,
    // One picker — a second copy shows the same list.
    singleton: true,
    order: 4,
    keywords: ['analytics', 'reports', 'insights', 'metrics', 'traffic', 'overview', 'charts'],
  },
  {
    // Opened from the picker (or a deep link), never the launcher: it takes an
    // `id`, so a launcher entry would have nothing to open. Emphatically NOT a
    // singleton — two dashboards side by side is the whole point of a dock.
    key: 'analytics.dashboard.view',
    title: 'Dashboard',
    module: 'platform',
    icon: faGauge,
    component: DashboardViewSurface,
    listed: false,
    keywords: ['dashboard', 'analytics', 'traffic'],
  },
];
