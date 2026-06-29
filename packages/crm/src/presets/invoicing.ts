// Invoicing module presets — additional billing-document workflows and line
// types beyond the two built-ins (docs/87). Each installs through the real
// invoicing service path (documentWorkflowService / documentLineTypeService), so
// a pack stamped via the picker, a starter, or the seed is identical and fully
// audit-logged.
//
// Built-ins to avoid (seeded on invoicing activation): workflow slugs `invoice`
// and `service-repair`; line-type keys `part` / `labor` / `sublet` / `freight` /
// `materials` / `fee` / `catalog`. Every slug/key below is new and non-colliding.
//
// These carry `module: 'invoicing'` (the seam gates them on the invoicing flag),
// but live in the CRM package because the invoicing services do (docs/87 §3).
//
// Data-as-code (line-limit exempt).

import type {
  CreateDocumentLineTypeInput,
  CreateDocumentStageInput,
  CreateDocumentWorkflowInput,
} from '@sparx/crm-schemas';
import type { TenantContext } from '@sparx/db';
import { definePreset, type ModulePreset } from '@sparx/modules';

import { documentLineTypeService, documentWorkflowService } from '../services/index';

// ─── Workflows ────────────────────────────────────────────────────────

interface StageDef {
  name: string;
  customerLabel: string;
  stageType: CreateDocumentStageInput['stageType'];
  numberOnEnter: boolean;
  numberPrefix?: string;
  snapshotOnEnter: boolean;
  locksEditing: boolean;
  color: string;
}

function workflowPreset(spec: {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  sortOrder: number;
  stages: StageDef[];
}): ModulePreset {
  return definePreset({
    module: 'invoicing',
    slug: spec.slug,
    kind: 'invoicing',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['invoicing', 'workflow', ...spec.tags],
    summary: [
      { label: spec.stages.map((s) => s.customerLabel).join(' → '), tone: 'neutral' },
      { label: `${spec.stages.length} stages`, tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.documentWorkflow
        .findUnique({
          where: { tenantId_slug: { tenantId, slug: spec.slug } },
          select: { id: true },
        })
        .then(Boolean),
    build: async (sx: TenantContext) => {
      const workflowInput: CreateDocumentWorkflowInput = {
        name: spec.name,
        slug: spec.slug,
        isDefault: false,
        sortOrder: spec.sortOrder,
      };
      const workflow = await documentWorkflowService.create(sx, workflowInput);
      let sortOrder = 0;
      for (const stage of spec.stages) {
        const stageInput: CreateDocumentStageInput = {
          name: stage.name,
          customerLabel: stage.customerLabel,
          stageType: stage.stageType,
          snapshotOnEnter: stage.snapshotOnEnter,
          numberOnEnter: stage.numberOnEnter,
          numberPrefix: stage.numberPrefix ?? null,
          locksEditing: stage.locksEditing,
          color: stage.color,
          sortOrder: sortOrder++,
        };
        await documentWorkflowService.createStage(sx, workflow.id, stageInput);
      }
      return { id: workflow.id };
    },
  });
}

const workflowPresets: ModulePreset[] = [
  workflowPreset({
    slug: 'retail-quote',
    name: 'Retail quote → invoice',
    description:
      'A straight retail flow: quote the customer, convert the accepted quote to an invoice, then mark it paid. Numbers and locks each document as it commits.',
    iconKey: 'file-text',
    tags: ['retail', 'quote', 'sales'],
    sortOrder: 2,
    stages: [
      {
        name: 'Quote',
        customerLabel: 'Quote',
        stageType: 'draft',
        numberOnEnter: true,
        numberPrefix: 'QT-',
        snapshotOnEnter: true,
        locksEditing: false,
        color: '#F59E0B',
      },
      {
        name: 'Accepted',
        customerLabel: 'Order confirmed',
        stageType: 'committed',
        numberOnEnter: false,
        snapshotOnEnter: true,
        locksEditing: false,
        color: '#06B6D4',
      },
      {
        name: 'Invoice',
        customerLabel: 'Invoice',
        stageType: 'final',
        numberOnEnter: true,
        numberPrefix: 'INV-',
        snapshotOnEnter: true,
        locksEditing: true,
        color: '#6366F1',
      },
      {
        name: 'Paid',
        customerLabel: 'Receipt',
        stageType: 'paid',
        numberOnEnter: false,
        snapshotOnEnter: false,
        locksEditing: true,
        color: '#10B981',
      },
    ],
  }),
  workflowPreset({
    slug: 'deposit-progress',
    name: 'Deposit & progress billing',
    description:
      'Staged billing for custom orders, events, and projects: take a deposit, bill milestones as work progresses, then issue the final balance invoice.',
    iconKey: 'milestone',
    tags: ['projects', 'deposit', 'milestones'],
    sortOrder: 3,
    stages: [
      {
        name: 'Deposit',
        customerLabel: 'Deposit invoice',
        stageType: 'open',
        numberOnEnter: true,
        numberPrefix: 'DEP-',
        snapshotOnEnter: true,
        locksEditing: false,
        color: '#EC4899',
      },
      {
        name: 'Deposit paid',
        customerLabel: 'Deposit received',
        stageType: 'committed',
        numberOnEnter: false,
        snapshotOnEnter: true,
        locksEditing: false,
        color: '#8B5CF6',
      },
      {
        name: 'Progress',
        customerLabel: 'Milestone invoice',
        stageType: 'open',
        numberOnEnter: true,
        numberPrefix: 'MS-',
        snapshotOnEnter: true,
        locksEditing: false,
        color: '#0EA5E9',
      },
      {
        name: 'Final',
        customerLabel: 'Final invoice',
        stageType: 'final',
        numberOnEnter: true,
        numberPrefix: 'INV-',
        snapshotOnEnter: true,
        locksEditing: true,
        color: '#6366F1',
      },
      {
        name: 'Paid',
        customerLabel: 'Receipt',
        stageType: 'paid',
        numberOnEnter: false,
        snapshotOnEnter: false,
        locksEditing: true,
        color: '#10B981',
      },
    ],
  }),
  workflowPreset({
    slug: 'subscription',
    name: 'Subscription billing',
    description:
      'A recurring-revenue flow for memberships, retainers, and subscriptions: draft the plan, activate it, then issue and collect each period’s invoice.',
    iconKey: 'repeat',
    tags: ['subscription', 'recurring', 'retainer'],
    sortOrder: 4,
    stages: [
      {
        name: 'Draft',
        customerLabel: 'Draft',
        stageType: 'draft',
        numberOnEnter: false,
        snapshotOnEnter: false,
        locksEditing: false,
        color: '#94A3B8',
      },
      {
        name: 'Active',
        customerLabel: 'Active subscription',
        stageType: 'open',
        numberOnEnter: true,
        numberPrefix: 'SUB-',
        snapshotOnEnter: false,
        locksEditing: false,
        color: '#06B6D4',
      },
      {
        name: 'Invoiced',
        customerLabel: 'Invoice',
        stageType: 'final',
        numberOnEnter: true,
        numberPrefix: 'INV-',
        snapshotOnEnter: true,
        locksEditing: true,
        color: '#6366F1',
      },
      {
        name: 'Paid',
        customerLabel: 'Receipt',
        stageType: 'paid',
        numberOnEnter: false,
        snapshotOnEnter: false,
        locksEditing: true,
        color: '#10B981',
      },
    ],
  }),
];

// ─── Line types ───────────────────────────────────────────────────────

interface LineTypeDef {
  key: string;
  name: string;
  label: string;
  pricingMode: CreateDocumentLineTypeInput['pricingMode'];
  defaultTaxable: boolean;
  category: string;
}

const RETAIL_LINE_TYPES: LineTypeDef[] = [
  {
    key: 'discount',
    name: 'Discount',
    label: 'Discount',
    pricingMode: 'flat',
    defaultTaxable: false,
    category: 'discount',
  },
  {
    key: 'installation',
    name: 'Installation',
    label: 'Installation / setup',
    pricingMode: 'flat',
    defaultTaxable: true,
    category: 'service',
  },
  {
    key: 'travel',
    name: 'Travel',
    label: 'Travel / mileage',
    pricingMode: 'flat',
    defaultTaxable: false,
    category: 'service',
  },
  {
    key: 'deposit-credit',
    name: 'Deposit credit',
    label: 'Deposit / prepayment credit',
    pricingMode: 'flat',
    defaultTaxable: false,
    category: 'payment',
  },
];

const retailLineTypesPreset: ModulePreset = definePreset({
  module: 'invoicing',
  slug: 'retail-line-types',
  kind: 'invoicing',
  name: 'Retail & services line types',
  description:
    'Four general-purpose line types — Discount, Installation, Travel, and Deposit credit — for retail and service invoices that aren’t covered by the parts-and-labor defaults.',
  iconKey: 'list-plus',
  tags: ['invoicing', 'line-types', 'retail', 'services'],
  summary: [
    { label: 'Discount · Installation · Travel · Deposit', tone: 'neutral' },
    { label: '4 line types', tone: 'module' },
  ],
  marker: (tx, tenantId) =>
    tx.billingDocumentLineType
      .findUnique({ where: { tenantId_key: { tenantId, key: 'discount' } }, select: { id: true } })
      .then(Boolean),
  build: async (sx: TenantContext) => {
    let firstId: string | null = null;
    let sortOrder = 100; // above the 0–6 built-ins
    for (const lt of RETAIL_LINE_TYPES) {
      const input: CreateDocumentLineTypeInput = {
        key: lt.key,
        name: lt.name,
        label: lt.label,
        pricingMode: lt.pricingMode,
        defaultTaxable: lt.defaultTaxable,
        defaultMarkupRuleId: null,
        computation: null,
        glCode: null,
        category: lt.category,
        isActive: true,
        sortOrder: sortOrder++,
      };
      const created = await documentLineTypeService.create(sx, input);
      firstId ??= created.id;
    }
    // Non-null: RETAIL_LINE_TYPES is a non-empty constant.
    return { id: firstId! };
  },
});

/** Every invoicing module preset, in picker order (workflows, then line types). */
export const invoicingPresets: ModulePreset[] = [...workflowPresets, retailLineTypesPreset];
