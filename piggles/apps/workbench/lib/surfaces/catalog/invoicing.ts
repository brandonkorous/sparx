// Invoicing — the module the workbench was proved on, so it is the most complete.

import { Eye, FileText, GitBranch, LayoutTemplate, Receipt } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { InvoiceEditorSurface } from '../../../surfaces/invoicing/invoice-editor';
import { InvoiceListSurface } from '../../../surfaces/invoicing/invoice-list';
import { InvoicePreviewSurface } from '../../../surfaces/invoicing/invoice-preview';
import { WorkflowEditorSurface } from '../../../surfaces/invoicing/workflow-editor';
import { WorkflowsListSurface } from '../../../surfaces/invoicing/workflows-list';
import { stub } from './stub';

export const INVOICING_SURFACES: SurfaceDefinition[] = [
  {
    key: 'invoicing.invoices.list',
    title: 'Invoices',
    module: 'invoicing',
    icon: Receipt,
    component: InvoiceListSurface,
    keywords: ['billing', 'receivables', 'ar', 'unpaid', 'quotes', 'estimates'],
    createSurface: 'invoicing.invoice.edit',
    createLabel: 'New invoice',
    order: 1,
  },
  {
    key: 'invoicing.invoice.edit',
    title: (params) => (params.id === 'new' ? 'New invoice' : 'Invoice'),
    module: 'invoicing',
    icon: FileText,
    component: InvoiceEditorSurface,
    // Reachable from the list and the nav's `+`, not the launcher — opening
    // "an invoice" with no invoice in mind isn't a thing anyone wants.
    listed: false,
  },
  {
    key: 'invoicing.invoice.preview',
    title: 'Preview',
    module: 'invoicing',
    icon: Eye,
    component: InvoicePreviewSurface,
    listed: false,
    besideWidth: 0.45,
  },

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  {
    key: 'invoicing.workflows',
    title: 'Workflows',
    module: 'invoicing',
    icon: GitBranch,
    component: WorkflowsListSurface,
    section: 'Setup',
    order: 10,
    keywords: ['stages', 'approval', 'quote to invoice'],
    createSurface: 'invoicing.workflow.edit',
    createLabel: 'New workflow',
  },
  {
    key: 'invoicing.workflow.edit',
    title: (params) => (params.id === 'new' ? 'New workflow' : 'Workflow'),
    module: 'invoicing',
    icon: GitBranch,
    component: WorkflowEditorSurface,
    // Same reasoning as the invoice editor: reachable from the list and the
    // nav's `+`, never the launcher — "open a workflow" with no workflow in
    // mind isn't a thing anyone wants.
    listed: false,
  },
  stub({
    key: 'invoicing.templates',
    title: 'Print templates',
    module: 'invoicing',
    icon: LayoutTemplate,
    section: 'Setup',
    order: 11,
    keywords: ['pdf', 'layout', 'letterhead', 'branding'],
    body: 'Print templates control what an invoice looks like when a customer opens or prints it.',
  }),
];
