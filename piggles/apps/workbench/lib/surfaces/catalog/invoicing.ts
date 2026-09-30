// Invoicing — the module the workbench was proved on, so it is the most complete.

import {
  faCodeBranch,
  faEye,
  faFileText,
  faReceipt,
  faTableLayout,
} from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
import { InvoiceEditorSurface } from '../../../surfaces/invoicing/invoice-editor';
import { newDocumentTitle } from '../../../surfaces/invoicing/document-words';
import { InvoiceListSurface } from '../../../surfaces/invoicing/invoice-list';
import { InvoicePreviewSurface } from '../../../surfaces/invoicing/invoice-preview';
import { TemplateEditorSurface } from '../../../surfaces/invoicing/template-editor';
import { TemplatePreviewSurface } from '../../../surfaces/invoicing/template-preview';
import { TemplatesListSurface } from '../../../surfaces/invoicing/templates-list';
import { WorkflowEditorSurface } from '../../../surfaces/invoicing/workflow-editor';
import { WorkflowsListSurface } from '../../../surfaces/invoicing/workflows-list';

export const INVOICING_SURFACES: SurfaceDefinition[] = [
  {
    key: 'invoicing.invoices.list',
    title: 'Invoices',
    module: 'invoicing',
    icon: faReceipt,
    component: InvoiceListSurface,
    keywords: ['billing', 'receivables', 'ar', 'unpaid', 'quotes', 'estimates'],
    createSurface: 'invoicing.invoice.edit',
    createLabel: 'New invoice',
    order: 1,
  },
  {
    key: 'invoicing.invoice.edit',
    // A new document is named after the KIND the caller asked for, so the tab
    // that opens from "Price up a quote" says quote and not invoice. Same
    // editor, same registry row, different errand (issue 761).
    title: (params) =>
      params.id === 'new'
        ? newDocumentTitle(typeof params.workflow === 'string' ? params.workflow : null)
        : 'Invoice',
    module: 'invoicing',
    icon: faFileText,
    component: InvoiceEditorSurface,
    // Reachable from the list and the nav's `+`, not the launcher — opening
    // "an invoice" with no invoice in mind isn't a thing anyone wants.
    listed: false,
  },
  {
    key: 'invoicing.invoice.preview',
    title: 'Preview',
    module: 'invoicing',
    icon: faEye,
    component: InvoicePreviewSurface,
    listed: false,
    besideWidth: 0.45,
  },

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  {
    key: 'invoicing.workflows',
    title: 'Workflows',
    module: 'invoicing',
    icon: faCodeBranch,
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
    icon: faCodeBranch,
    component: WorkflowEditorSurface,
    // Same reasoning as the invoice editor: reachable from the list and the
    // nav's `+`, never the launcher — "open a workflow" with no workflow in
    // mind isn't a thing anyone wants.
    listed: false,
  },
  {
    key: 'invoicing.templates',
    title: 'Print templates',
    module: 'invoicing',
    icon: faTableLayout,
    component: TemplatesListSurface,
    section: 'Setup',
    order: 11,
    keywords: ['pdf', 'layout', 'letterhead', 'branding'],
    createSurface: 'invoicing.template.edit',
    createLabel: 'New template',
  },
  {
    key: 'invoicing.template.edit',
    title: (params) => (params.id === 'new' ? 'New template' : 'Print template'),
    module: 'invoicing',
    icon: faTableLayout,
    component: TemplateEditorSurface,
    // Same reasoning as the invoice and workflow editors: reachable from the
    // list and the nav's `+`, never the launcher.
    listed: false,
  },
  {
    key: 'invoicing.template.preview',
    title: 'Preview',
    module: 'invoicing',
    icon: faEye,
    component: TemplatePreviewSurface,
    listed: false,
    besideWidth: 0.45,
  },
];
