// Dashboard shell manifest for the Invoicing module (docs/87).
//
// Pure shell UI (lucide icons + @sparx/ui/shell types) — lives in the dashboard,
// not @sparx/crm, so the service-layer package stays backend-safe. Mirrors the
// CRM manifest. The `invoicing` module is gated by its own flag (not a plan tier);
// the layout's <ModuleGate> enforces it. See docs/24-dashboard-shell.md §3.

import type { ModuleManifest } from '@sparx/ui/shell';
import { FileText, GitBranch, LayoutTemplate, Plus, ReceiptText } from 'lucide-react';

export const invoicingManifest: ModuleManifest = {
  id: 'invoicing',
  label: 'Invoicing',
  icon: ReceiptText,
  routePrefix: '/invoicing',
  sections: [
    { id: 'documents', label: 'Documents', icon: FileText, href: '/invoicing/documents' },
    {
      id: 'workflows',
      label: 'Workflows',
      icon: GitBranch,
      href: '/invoicing/workflows',
    },
    {
      id: 'templates',
      label: 'Print templates',
      icon: LayoutTemplate,
      href: '/invoicing/templates',
    },
  ],
  actions: [
    {
      id: 'invoicing.document.create',
      label: 'New document',
      icon: Plus,
      href: '/invoicing/documents/new',
    },
  ],
  entityTypes: [
    // No `hasDetailView`: the document editor is a wide, interactive full-page
    // surface (like the CRM pipeline board), so OPENING a document always goes
    // full-page rather than into a drawer. CREATING one, however, opts into the
    // drawer/modal create overlay (CREATE_VIEW_TYPES + detail-slot) so the "New"
    // button honors the user's `defaultDetailView`; the full page lives at
    // /invoicing/documents/new.
    { id: 'billing-document', label: 'Document', routePrefix: '/invoicing/documents' },
    // Workflow create-only overlay. The workflow's stage editor is a full-page
    // surface, so no `hasDetailView`; the single-step SurfaceFrame create opts into
    // the drawer/modal, and a created workflow continues to its edit screen.
    { id: 'workflow', label: 'Workflow', routePrefix: '/invoicing/workflows' },
  ],
};
