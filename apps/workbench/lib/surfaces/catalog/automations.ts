// Automations — the cross-module rule engine's surfaces.
//
// Lifted out of small-modules.ts once the section grew past a single stub into a
// full operator experience: the rules you author, the runs they produce, and the
// activity report over the top. Mirrors how dropship.ts was extracted.
//
// The keys are the contract — persisted in saved layouts and deep links — so
// they must stay stable. `automations.list` keeps the key its stub registered,
// so nobody's saved workspace or bookmark breaks in the swap from stub to real
// screen.
//
// Every surface stays `module: 'automations'`, so the pane accent is the
// automations hue. The module tags a rule carries (Customers, Email, …) wear
// THEIR module's hue via a nested scope inside the surface itself.

import { History, ListChecks, Workflow } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { AutomationsListSurface } from '../../../surfaces/automations/automations-list';
import { AutomationDetailSurface } from '../../../surfaces/automations/automation-detail';
import { AutomationRunsSurface } from '../../../surfaces/automations/automation-runs';
import { AutomationRunDetailSurface } from '../../../surfaces/automations/run-detail';
import { AutomationsReportsSurface } from '../../../surfaces/automations/automations-reports';

export const AUTOMATION_SURFACES: SurfaceDefinition[] = [
  {
    // Unsectioned on purpose: the rules list is where the module starts, so the
    // row leads the panel above the grouped sections.
    key: 'automations.list',
    title: 'Automations',
    module: 'automations',
    icon: Workflow,
    order: 1,
    keywords: ['rules', 'when this then that', 'triggers', 'workflow', 'jobs'],
    component: AutomationsListSurface,
    createSurface: 'automations.detail',
    createLabel: 'New automation',
  },
  {
    key: 'automations.detail',
    title: 'Automation',
    module: 'automations',
    icon: Workflow,
    // Opened from the list ({id:'new'} to build one, {id} to manage) — create is
    // the same surface as manage, so it is a pane, not a launcher entry.
    listed: false,
    component: AutomationDetailSurface,
  },

  /* ── Activity ──────────────────────────────────────────────────────────── */
  {
    key: 'automations.runs',
    title: 'Automation runs',
    module: 'automations',
    icon: ListChecks,
    // Always scoped to one rule ({automationId}) and reached from that rule's
    // toolbar — opening "runs" cold has no rule to show.
    listed: false,
    component: AutomationRunsSurface,
  },
  {
    key: 'automations.run',
    title: 'Automation run',
    module: 'automations',
    icon: ListChecks,
    // One run + its step timeline, reached from a run row.
    listed: false,
    component: AutomationRunDetailSurface,
  },

  /* ── Reporting ─────────────────────────────────────────────────────────── */
  {
    key: 'automations.reports',
    title: 'Activity & reports',
    module: 'automations',
    icon: History,
    section: 'Reporting',
    order: 20,
    keywords: ['runs', 'success rate', 'activity', 'history', 'performance'],
    // Not a singleton: each instance owns its own period + scope, so two side by
    // side is a real comparison.
    component: AutomationsReportsSurface,
  },
];
