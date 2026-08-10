// CRM module presets — the crm entries in the platform module-preset registry.
// Two kinds: deal `pipeline` packs (a pipeline + its ordered stages) and dynamic
// customer `segments` (a saved predicate tree). Each installs through the real
// CRM service path (pipelineService / segmentService), so a pack stamped via the
// à-la-carte picker, an industry starter, or the seed is identical.
//
// Slugs avoid the built-ins CRM activation already seeds (pipeline 'sales';
// segments 'high-value' / 'at-risk' / 'b2b-fleet' / 'new-customers' / newsletter
// / early-access) so an install never collides with the default set.
//
// Data-as-code (line-limit exempt).

import type {
  CreatePipelineInput,
  CreatePipelineStageInput,
  CreateSegmentInput,
  SegmentRule,
} from '@sparx/crm-schemas';
import type { TenantContext } from '@sparx/db';
import { definePreset, type ModulePreset } from '@sparx/modules';

import { pipelineService, segmentService } from '../services/index';

// ─── Pipelines ────────────────────────────────────────────────────────

interface StageDef {
  name: string;
  probability: number;
  stageType: CreatePipelineStageInput['stageType'];
  color: string;
}

function pipelinePreset(spec: {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  stages: StageDef[];
}): ModulePreset {
  return definePreset({
    module: 'crm',
    slug: spec.slug,
    kind: 'pipeline',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['pipeline', ...spec.tags],
    summary: [
      { label: spec.stages.map((s) => s.name).join(' → '), tone: 'neutral' },
      { label: `${spec.stages.length} stages`, tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.pipeline
        .findFirst({ where: { tenantId, slug: spec.slug, archivedAt: null }, select: { id: true } })
        .then(Boolean),
    build: async (sx: TenantContext) => {
      const pipelineInput: CreatePipelineInput = {
        name: spec.name,
        slug: spec.slug,
        // Every preset pipeline is a SALES process (docs/144 §7.2). Stated
        // rather than left to the schema default because `CreatePipelineInput`
        // is the PARSED type, where a defaulted field is already resolved.
        objectKey: 'deal',
        isDefault: false,
        sortOrder: 0,
      };
      const pipeline = await pipelineService.create(sx, pipelineInput);
      let sortOrder = 0;
      for (const stage of spec.stages) {
        const stageInput: CreatePipelineStageInput = {
          name: stage.name,
          sortOrder: sortOrder++,
          probability: stage.probability,
          stageType: stage.stageType,
          color: stage.color,
        };
        await pipelineService.createStage(sx, pipeline.id, stageInput);
      }
      return { id: pipeline.id };
    },
  });
}

const pipelinePresets: ModulePreset[] = [
  pipelinePreset({
    slug: 'b2b-sales',
    name: 'B2B sales pipeline',
    description:
      'An enterprise-acquisition funnel from prospect to signed contract, with a legal-review gate before close. Pairs with deals and quotes.',
    iconKey: 'trending-up',
    tags: ['sales', 'b2b'],
    stages: [
      { name: 'Prospect', probability: 5, stageType: 'open', color: '#94A3B8' },
      { name: 'Qualified', probability: 20, stageType: 'open', color: '#06B6D4' },
      { name: 'Proposal sent', probability: 50, stageType: 'open', color: '#6366F1' },
      { name: 'Legal review', probability: 75, stageType: 'open', color: '#8B5CF6' },
      { name: 'Signed', probability: 100, stageType: 'won', color: '#10B981' },
      { name: 'Lost', probability: 0, stageType: 'lost', color: '#EF4444' },
    ],
  }),
  // There is deliberately NO 'support' preset here any more.
  //
  // There used to be one — "Support pipeline", stages New / In progress /
  // Awaiting customer / Resolved — and every preset in this file builds a DEAL
  // pipeline (`objectKey: 'deal'`, stated in `pipelinePreset`). Before service
  // requests existed that was merely a sales board with support-shaped stage
  // names. Now that they do, it is a trap: a tenant looking for support installs
  // the thing called "Support pipeline", gets a deal board that looks right, and
  // works it for weeks wondering why no reply deadlines are ever measured and
  // why the Requests queue stays empty.
  //
  // The real support queue is not a preset and must not become one. It is
  // created automatically, with a response promise attached, by the first
  // request a tenant ever files (`ensureTicketPipeline` + `ensureDefaultPolicy`)
  // — so there is nothing here to install, and a second ticket pipeline offered
  // from a picker would only split the queue.

  pipelinePreset({
    slug: 'recruiting',
    name: 'Recruiting pipeline',
    description:
      'A hiring funnel from application to offer — screen, interview, final round, and hire. Reuse the deal board for candidates.',
    iconKey: 'users',
    tags: ['recruiting', 'hr'],
    stages: [
      { name: 'Applied', probability: 5, stageType: 'open', color: '#94A3B8' },
      { name: 'Phone screen', probability: 20, stageType: 'open', color: '#06B6D4' },
      { name: 'Interview', probability: 45, stageType: 'open', color: '#6366F1' },
      { name: 'Final round', probability: 70, stageType: 'open', color: '#8B5CF6' },
      { name: 'Hired', probability: 100, stageType: 'won', color: '#10B981' },
      { name: 'Passed', probability: 0, stageType: 'lost', color: '#EF4444' },
    ],
  }),
];

// ─── Segments ─────────────────────────────────────────────────────────

function segmentPreset(spec: {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  chip: string;
  color: string;
  rules: SegmentRule;
}): ModulePreset {
  return definePreset({
    module: 'crm',
    slug: spec.slug,
    kind: 'segments',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['segment', ...spec.tags],
    summary: [
      { label: 'Dynamic membership', tone: 'neutral' },
      { label: spec.chip, tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.segment
        .findFirst({ where: { tenantId, slug: spec.slug, archivedAt: null }, select: { id: true } })
        .then(Boolean),
    build: async (sx: TenantContext) => {
      const input: CreateSegmentInput = {
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        color: spec.color,
        // Every preset segment is rule-driven — that is what a preset IS: a
        // definition worth starting from. A hand-picked list has nothing to
        // preset, since its whole content is the tenant's own choices.
        kind: 'dynamic',
        rules: spec.rules,
      };
      const segment = await segmentService.create(sx, input);
      return { id: segment.id };
    },
  });
}

const segmentPresets: ModulePreset[] = [
  segmentPreset({
    slug: 'vip-customers',
    name: 'VIP customers',
    description:
      'Your highest-value, still-active customers — $10,000+ lifetime spend with an order in the last 60 days. Target them with early access and perks.',
    iconKey: 'crown',
    tags: ['retention', 'vip'],
    chip: '$10k+ · active 60d',
    color: '#F59E0B',
    rules: {
      kind: 'and',
      children: [
        { kind: 'predicate', field: 'customer.totalSpent', op: 'gte', value: 10000 },
        { kind: 'predicate', field: 'customer.daysSinceLastOrder', op: 'lte', value: 60 },
        { kind: 'predicate', field: 'customer.doNotContact', op: 'eq', value: false },
      ],
    },
  }),
  segmentPreset({
    slug: 'dormant-winback',
    name: 'Dormant — win-back',
    description:
      'Past buyers who have gone quiet — at least one order, but nothing in 90+ days. The natural audience for a win-back campaign.',
    iconKey: 'clock-alert',
    tags: ['retention', 'churn'],
    chip: 'Ordered · 90d+ quiet',
    color: '#EF4444',
    rules: {
      kind: 'and',
      children: [
        { kind: 'predicate', field: 'customer.orderCount', op: 'gte', value: 1 },
        { kind: 'predicate', field: 'customer.daysSinceLastOrder', op: 'gte', value: 90 },
        { kind: 'predicate', field: 'customer.doNotContact', op: 'eq', value: false },
      ],
    },
  }),
  segmentPreset({
    slug: 'email-engaged',
    name: 'Email engaged',
    description:
      'Subscribers who opened or clicked an email in the last 30 days and still hold marketing consent — your warmest list for the next send.',
    iconKey: 'mail-check',
    tags: ['marketing', 'engagement'],
    chip: 'Opened/clicked 30d',
    color: '#8B5CF6',
    rules: {
      kind: 'and',
      children: [
        {
          kind: 'or',
          children: [
            { kind: 'predicate', field: 'email.openedLast30d', op: 'gte', value: 1 },
            { kind: 'predicate', field: 'email.clickedLast30d', op: 'gte', value: 1 },
          ],
        },
        { kind: 'predicate', field: 'email.subscribed', op: 'eq', value: true },
      ],
    },
  }),
];

/** Every CRM module preset, in picker order (pipelines, then segments). */
export const crmPresets: ModulePreset[] = [...pipelinePresets, ...segmentPresets];
