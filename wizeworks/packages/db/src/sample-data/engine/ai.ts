// AI slice (docs/07 §9) — applied only when the `ai` module is on. Two things make
// an AI-enabled demo tenant feel alive:
//
//   1. A small prompt LIBRARY (sample-* keys, metadata.sample so Clear removes them)
//      so the /ai prompt surface isn't empty. These are DEMO rows — the platform's
//      real default library is installed separately by the `ai` module preset.
//   2. A spread of `McpToolCall` audit rows so the /ai dashboard's KPIs, timeseries,
//      top-tools, and activity feed render with real-looking history (the dashboard
//      reads audit_logs where entity_type='McpToolCall' — wizeworks/services/api-rest ai/reports).
//
// Both are derived from the pack (label + enabled modules) so every industry gets a
// fitting demo without per-pack authoring; a pack may override the prompts via
// `pack.aiPrompts`. Marked sample (key prefix + metadata/diff `sample:true`) so Clear
// + summarize find them without a schema change.

import type { Prisma } from '@prisma/client';

import { withSampleMeta } from '../markers';
import type { SampleAiPrompt, SampleDataPack } from '../types';
import { type ApplyCtx, daysAgo } from './context';

const SAMPLE_PROMPT_PREFIX = 'sample-';

/** A small industry-flavored prompt set when the pack doesn't author its own. */
function derivePrompts(pack: SampleDataPack): SampleAiPrompt[] {
  const biz = pack.label;
  return [
    {
      key: 'support-persona',
      name: 'Support assistant persona',
      description: 'Voice + guardrails the storefront chat assistant uses.',
      category: 'persona',
      body: [
        `You are the customer-support assistant for {{business_name}}, a ${biz.toLowerCase()} business.`,
        '',
        'Be warm, concise, and genuinely helpful — never pushy. Answer only from the catalog, pages, and policies you are given; never invent prices, stock, or order details. If a question needs account-specific data or anything outside that context, hand off to a human instead of guessing.',
      ].join('\n'),
      variables: [{ key: 'business_name', label: 'Business name', example: biz }],
    },
    {
      key: 'product-description',
      name: 'Product description writer',
      description: 'Turns a few details into polished, benefit-led product copy.',
      category: 'product',
      body: 'Write a product description for "{{product_name}}".\n\nDetails:\n{{key_features}}\n\nLead with the customer benefit, two short paragraphs then a 3–5 item feature list. Avoid hype words.',
      variables: [
        { key: 'product_name', label: 'Product name' },
        { key: 'key_features', label: 'Key features (one per line)' },
      ],
    },
    {
      key: 'win-back-email',
      name: 'Win-back email',
      description: 'Re-engages a lapsed customer with a warm, low-pressure nudge.',
      category: 'email',
      body: 'Write a short win-back email to {{customer_name}} (last ordered {{last_purchase}}). Offer: {{incentive}}. Under 120 words, friendly subject line, one clear call to action.',
      variables: [
        { key: 'customer_name', label: 'Customer name' },
        { key: 'last_purchase', label: 'Last purchase' },
        { key: 'incentive', label: 'Incentive' },
      ],
    },
    {
      key: 'review-response',
      name: 'Review response',
      description: 'Drafts a gracious public response to a customer review.',
      category: 'crm',
      body: 'Draft a public response to this {{rating}}-star review:\n"{{review_text}}"\n\nThank them, be specific, and for criticism take responsibility without being defensive. Under 80 words.',
      variables: [
        { key: 'rating', label: 'Rating (1–5)' },
        { key: 'review_text', label: 'Review text' },
      ],
    },
  ];
}

async function applyPrompts(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  const prompts = pack.aiPrompts ?? derivePrompts(pack);
  for (const p of prompts) {
    await ctx.tx.aiPromptTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        key: `${SAMPLE_PROMPT_PREFIX}${p.key}`,
        name: p.name,
        description: p.description ?? null,
        category: p.category,
        body: p.body,
        variables: p.variables ?? [],
        createdByUserId: ctx.ownerUserId,
        metadata: withSampleMeta(),
      },
    });
    ctx.counts.aiPrompts += 1;
  }
}

// Representative MCP tools per module — the demo dashboard reflects the tenant's
// actual enabled modules (a content-only tenant won't show inventory tool calls).
const TOOL_SAMPLES: { tool: string; module: string | null; input: Record<string, unknown> }[] = [
  { tool: 'get_orders', module: 'commerce', input: { status: 'open' } },
  { tool: 'get_order_stats', module: 'commerce', input: { period: 'this_month' } },
  { tool: 'get_products', module: 'commerce', input: {} },
  { tool: 'get_product_performance', module: 'commerce', input: { period: 'this_quarter' } },
  { tool: 'get_top_customers', module: 'crm', input: { period: 'this_quarter', limit: 10 } },
  { tool: 'get_customers', module: 'crm', input: { search: '' } },
  { tool: 'get_pipeline', module: 'crm', input: {} },
  { tool: 'get_low_inventory', module: 'inventory', input: {} },
  { tool: 'suggest_reorders', module: 'inventory', input: {} },
  { tool: 'get_email_stats', module: 'email', input: { period: 'this_month' } },
  {
    tool: 'get_revenue_summary',
    module: null,
    input: { period: 'this_month', compare_to: 'last_month' },
  },
  { tool: 'get_sales_by_product', module: null, input: { period: 'this_month' } },
];

async function applyToolCalls(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  void pack;
  const enabled = TOOL_SAMPLES.filter((t) => t.module === null || ctx.isOn(t.module));
  let seq = 0;
  for (const t of enabled) {
    const calls = 1 + (seq % 3); // 1–3 calls each, so top tools out-rank others
    for (let k = 0; k < calls; k++) {
      const outcome = (seq + k) % 11 === 0 ? 'error' : 'success';
      const when = daysAgo(ctx, (seq * 2 + k) % 14);
      when.setUTCHours(9 + ((seq + k) % 9), (seq * 7 + k) % 60, 0, 0);
      await ctx.tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorId: ctx.ownerUserId,
          actorType: 'api',
          action: `mcp.${t.tool}`,
          entityType: 'McpToolCall',
          entityId: null,
          diff: {
            input: t.input,
            outcome,
            sample: true,
            ...(outcome === 'error' ? { error: 'Sample: upstream timeout' } : {}),
          } as Prisma.InputJsonValue,
          createdAt: when,
        },
      });
      ctx.counts.toolCalls += 1;
      seq += 1;
    }
  }
}

/** Seed the demo prompt library + MCP usage history. Gated on the `ai` module. */
export async function applyAi(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('ai')) return;
  await applyPrompts(ctx, pack);
  await applyToolCalls(ctx, pack);
}
