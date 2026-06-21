import { requireSession } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';

import type { LineTypeOption, PartyOption, WorkflowOption } from './_components/invoice-wizard';
import type { MarkupRuleSummary } from '../_lib/markup';

// Server-side data the invoice / billing-document wizard needs, resolved once and
// shared by BOTH surfaces: the full-page `/new` route and the Documents-list
// drawer/modal create overlay (registered in `detail-slot.tsx`). Keeping the
// fetch + shape mapping here is the documented pattern for create overlays needing
// server data — and it means the two surfaces can never drift.

interface WorkflowApi {
  id: string;
  name: string;
  isDefault: boolean;
  stages: {
    id: string;
    name: string;
    customerLabel: string;
    stageType: string;
    sortOrder: number;
    numberOnEnter: boolean;
    snapshotOnEnter: boolean;
    locksEditing: boolean;
  }[];
}
interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}
interface B2bAccountLite {
  id: string;
  companyName: string;
}
interface LineTypeApi {
  id: string;
  key: string;
  label: string;
  pricingMode: string;
  defaultTaxable: boolean;
  isActive: boolean;
}
type MarkupRuleApi = MarkupRuleSummary & { appliesTo: string };

export interface InvoiceWizardData {
  workflows: WorkflowOption[];
  customers: PartyOption[];
  b2bAccounts: PartyOption[];
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  currentUserId: string;
}

export async function loadInvoiceWizardData(): Promise<InvoiceWizardData> {
  const [session, workflows, customers, b2bAccounts, lineTypes, markupRules] = await Promise.all([
    requireSession(),
    api.get<WorkflowApi[]>('/v1/invoicing/workflows'),
    api
      .getPaged<CustomerLite[]>('/v1/crm/customers?take=200&sort_by=updatedAt')
      .then((r) => r.data)
      .catch(() => []),
    api
      .getPaged<B2bAccountLite[]>('/v1/crm/b2b-accounts?take=200')
      .then((r) => r.data)
      .catch(() => []),
    api.get<LineTypeApi[]>('/v1/invoicing/line-types').catch(() => []),
    // Document-applicable markup rules — Commerce may be off on a services-only
    // tenant (404); degrade to ad-hoc markup only.
    api
      .get<MarkupRuleApi[]>('/v1/markup-rules?is_active=true')
      .then((rules) => rules.filter((r) => r.appliesTo === 'document' || r.appliesTo === 'both'))
      .catch(() => [] as MarkupRuleApi[]),
  ]);

  return {
    workflows: workflows.map((w) => ({
      id: w.id,
      name: w.name,
      isDefault: w.isDefault,
      stages: w.stages.map((s) => ({
        id: s.id,
        name: s.name,
        customerLabel: s.customerLabel,
        stageType: s.stageType,
        sortOrder: s.sortOrder,
        numberOnEnter: s.numberOnEnter,
        snapshotOnEnter: s.snapshotOnEnter,
        locksEditing: s.locksEditing,
      })),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      label:
        [c.firstName, c.lastName].filter(Boolean).join(' ') ||
        (c.company ?? c.email ?? c.id.slice(0, 8)),
    })),
    b2bAccounts: b2bAccounts.map((a) => ({ id: a.id, label: a.companyName })),
    lineTypes: lineTypes
      .filter((t) => t.isActive)
      .map((t) => ({
        id: t.id,
        key: t.key,
        label: t.label,
        pricingMode: t.pricingMode,
        defaultTaxable: t.defaultTaxable,
      })),
    markupRules,
    currentUserId: session.user.id,
  };
}
