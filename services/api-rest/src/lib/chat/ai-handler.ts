// Live Chat — AI first-responder (docs/56, docs/69 A-3).
//
// Invoked fire-and-forget after a customer message is persisted (public REST +
// WebSocket paths). It answers product/policy questions with Claude Haiku and
// escalates to a human when unsure, outside operating hours, or when AI is off.
// Escalation publishes `chat.message.received` so the notification fallbacks
// (email-worker + web push, A-6) can alert staff.
//
// Grounding context comes from the tenant's own catalog + published pages via
// RLS — not Typesense — because per-tenant Typesense reindex isn't live yet
// (see memory project_typesense_build_progress). Swap in Typesense retrieval
// here once it is, without touching callers.

import Anthropic from '@anthropic-ai/sdk';
import type { FastifyBaseLogger } from 'fastify';
import { withTenant, prisma } from '@sparx/db';
import type { TenantContext } from '@sparx/db';
import {
  STOREFRONT_TOOLS,
  toAnthropicTools,
  StorefrontApiClient,
  StorefrontApiError,
} from '@sparx/storefront-mcp';

import { resolveActivePropertyName } from '../property.js';
import { getActivePersona } from '../ai/prompt-templates.js';
import { env } from '../../env.js';
import { conversationService } from './index.js';
import { getChatConfig, isWithinOperatingHours } from './config.js';
import { getChatBroadcaster } from './broadcaster.js';
import { escalateToHuman } from './notify.js';

const MODEL = 'claude-haiku-4-5-20251001';
const CONFIDENCE_THRESHOLD = 0.8;
const HANDOFF_MESSAGE =
  "Thanks! I've passed this along to our team — someone will follow up shortly.";

// Tool-use loop bounds (docs/113 §3.4). Each turn the model either calls a
// lookup tool or `respond`; we cap the round-trips so a confused model can't
// loop forever, and clamp tool output so a big list can't blow the context.
const MAX_TOOL_TURNS = 4;
const MAX_TOOL_RESULT_CHARS = 6000;

// The concierge may call the READ storefront tools to ground its answers
// (search products, check availability, prices, store info). Guest-WRITE tools
// (book/cart) are deliberately withheld from the bot — mutations run through the
// external shopper MCP, where the shopper's own client confirms — so the
// concierge can look anything up but never acts on the customer's behalf.
const CONCIERGE_TOOLS = STOREFRONT_TOOLS.filter((t) => t.kind === 'read');

const RESPOND_TOOL: Anthropic.Tool = {
  name: 'respond',
  description: 'Respond to the customer or escalate the conversation to a human agent.',
  input_schema: {
    type: 'object',
    properties: {
      answer: {
        type: 'string',
        description: 'The reply to send to the customer (shown verbatim).',
      },
      confidence: {
        type: 'number',
        description: 'How confident you are the answer is correct and grounded, 0 to 1.',
      },
      escalate: {
        type: 'boolean',
        description: 'True if a human should take over instead of sending the answer.',
      },
    },
    required: ['answer', 'confidence', 'escalate'],
    additionalProperties: false,
  },
};

// respond + the read lookup tools. tool_choice is forced to `any` so every turn
// is a tool call (never loose prose) — the model gathers via lookups, then
// finalizes with `respond`.
const TOOL_DEFS: Anthropic.Tool[] = [
  ...toAnthropicTools(CONCIERGE_TOOLS).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  })),
  RESPOND_TOOL,
];

interface AiDecision {
  answer: string;
  confidence: number;
  escalate: boolean;
}

/** The tenant's slug (public routes key on `?tenant=<slug>`). Null if unknown. */
async function resolveTenantSlug(tenantId: string): Promise<string | null> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  return t?.slug ?? null;
}

/**
 * Attempt an AI reply to the latest customer message on a conversation. Safe to
 * call fire-and-forget — it swallows its own errors (logging them) so the
 * customer's send is never blocked or failed by the AI path.
 */
export async function handleInboundForAI(
  ctx: TenantContext,
  conversationId: string,
  logger: FastifyBaseLogger
): Promise<void> {
  try {
    const config = await getChatConfig(ctx.tenantId);

    // AI disabled or no API key → a human must handle it.
    if (!config.aiEnabled || !env.ANTHROPIC_API_KEY) {
      await escalateToHuman(ctx, conversationId, logger, 'ai_disabled');
      return;
    }

    const conversation = await conversationService.get(ctx, conversationId, { messageTake: 12 });

    // A staff member is already on it — the bot stands down.
    if (conversation.assignedToId) return;

    // Outside operating hours → away message + escalate.
    if (!isWithinOperatingHours(config)) {
      const away = await conversationService.addMessage(ctx, conversationId, {
        senderType: 'ai',
        body: config.awayMessage,
        aiGenerated: true,
      });
      getChatBroadcaster()?.messageCreated(ctx.tenantId, conversationId, away);
      await escalateToHuman(ctx, conversationId, logger, 'away');
      return;
    }

    const lastCustomer = [...conversation.messages]
      .reverse()
      .find((m) => m.senderType === 'customer');
    if (!lastCustomer) return; // nothing to answer

    const decision = await askClaude(ctx.tenantId, conversation.messages, config.greeting, logger);
    if (!decision) return; // API failed — staff still sees the inbound message

    if (decision.confidence >= CONFIDENCE_THRESHOLD && !decision.escalate) {
      const reply = await conversationService.addMessage(ctx, conversationId, {
        senderType: 'ai',
        body: decision.answer,
        aiGenerated: true,
        aiConfidence: decision.confidence,
      });
      getChatBroadcaster()?.messageCreated(ctx.tenantId, conversationId, reply);
      return;
    }

    // Low confidence or explicit escalation → hand off to a human.
    const handoff = await conversationService.addMessage(ctx, conversationId, {
      senderType: 'ai',
      body: HANDOFF_MESSAGE,
      aiGenerated: true,
      aiConfidence: decision.confidence,
    });
    getChatBroadcaster()?.messageCreated(ctx.tenantId, conversationId, handoff);
    await escalateToHuman(ctx, conversationId, logger, 'escalated');
  } catch (err) {
    logger.error({ err, conversationId }, 'chat AI handler failed');
  }
}

interface GroundingDto {
  siteName: string;
  products: string[];
  pages: string[];
}

async function buildGrounding(tenantId: string): Promise<GroundingDto> {
  // The assistant introduces itself as the SITE (the tenant's primary site —
  // docs/49), shown to the customer in the chat widget. Never the tenant's
  // legal/org name.
  const siteName = (await resolveActivePropertyName(tenantId, null)) || 'this store';
  const { products, pages } = await withTenant({ tenantId }, async (tx) => {
    const [products, pages] = await Promise.all([
      tx.product.findMany({
        where: { status: 'active', deletedAt: null },
        select: { title: true, description: true },
        take: 30,
        orderBy: { updatedAt: 'desc' },
      }),
      tx.page.findMany({
        where: { status: 'published' },
        select: { title: true },
        take: 20,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { products, pages };
  });

  return {
    siteName,
    products: products.map((p) => {
      const desc = p.description ? stripHtml(p.description).slice(0, 120) : '';
      return desc ? p.title + ' — ' + desc : p.title;
    }),
    pages: pages.map((p) => p.title),
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSystemPrompt(g: GroundingDto, persona: string | null): string {
  const catalog = g.products.length
    ? `Products currently sold:\n${g.products.map((p) => `- ${p}`).join('\n')}`
    : 'No product catalog is available.';
  const info = g.pages.length
    ? `Information / policy pages on the site: ${g.pages.join(', ')}.`
    : '';
  // The tenant's active `persona` prompt-template (docs/07 §9) supplies the
  // assistant's voice + guardrails, with `{{business_name}}` resolved to the
  // customer-facing site name. Falls back to the platform default voice. Either way
  // the functional tool contract below is ALWAYS appended — the `respond` tool +
  // confidence + escalation are wired to tool_choice and must not be overridable.
  const intro = persona
    ? persona.replace(/\{\{\s*business_name\s*\}\}/g, g.siteName)
    : [
        `You are the customer-support assistant for ${g.siteName}, embedded in its storefront chat widget.`,
        'Answer concisely and only from the context below. If the customer asks about an order, account, refund, a specific price, availability, or anything not covered by the context, do NOT guess.',
      ].join('\n\n');
  return [
    intro,
    'You have lookup tools — use them to fetch real products, prices, availability, services, and store info before answering; never guess specifics. When you have what you need (or determine you cannot answer), call the `respond` tool. Set confidence between 0 and 1 for how sure you are the answer is correct and grounded — be honest, low confidence beats a wrong answer. For order/account/refund specifics, or anything the tools cannot resolve, set escalate to true so a human takes over.',
    catalog,
    info,
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function askClaude(
  tenantId: string,
  messages: { senderType: string; body: string }[],
  _greeting: string,
  logger: FastifyBaseLogger
): Promise<AiDecision | null> {
  try {
    const [grounding, persona, tenantSlug] = await Promise.all([
      buildGrounding(tenantId),
      getActivePersona(tenantId),
      resolveTenantSlug(tenantId),
    ]);
    if (!tenantSlug) return null; // can't scope tool calls without the tenant slug

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    // The concierge calls the storefront's OWN public API — the same routes the
    // shopper MCP uses — over a loopback call. One execution path, real parity.
    const client = new StorefrontApiClient(`http://127.0.0.1:${env.PORT}`, { tenantSlug });

    // Map the thread to Anthropic turns: customer → user, staff/ai → assistant.
    // The thread always opens with the customer's first message, so it starts on
    // a user turn; the tool loop appends assistant tool_use + user tool_result.
    const convo: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.senderType === 'customer' ? ('user' as const) : ('assistant' as const),
      content: m.body,
    }));

    const model = persona?.model ?? MODEL;
    const system = buildSystemPrompt(grounding, persona?.body ?? null);

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system,
        messages: convo,
        tools: TOOL_DEFS,
        tool_choice: { type: 'any' },
      });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      const respondUse = toolUses.find((b) => b.name === 'respond');
      if (respondUse) return parseDecision(respondUse.input);
      if (toolUses.length === 0) return null; // forced tool_choice:any should prevent this

      // Execute the lookup tools this turn and feed results back for the next.
      convo.push({ role: 'assistant', content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        results.push(await runConciergeTool(client, tenantSlug, use, logger));
      }
      convo.push({ role: 'user', content: results });
    }

    logger.warn({ tenantId }, 'chat AI: tool loop hit the turn cap without responding');
    return null;
  } catch (err) {
    logger.error({ err }, 'chat AI: Anthropic call failed');
    return null;
  }
}

function parseDecision(input: unknown): AiDecision | null {
  const p = input as Partial<AiDecision>;
  if (typeof p.answer !== 'string' || typeof p.confidence !== 'number') return null;
  return {
    answer: p.answer,
    confidence: Math.max(0, Math.min(1, p.confidence)),
    escalate: p.escalate === true,
  };
}

/** Run one concierge lookup tool and shape the Anthropic tool_result. A failed
 *  lookup becomes an is_error result the model can see and route around — it
 *  never throws out of the loop. */
async function runConciergeTool(
  client: StorefrontApiClient,
  tenantSlug: string,
  use: Anthropic.ToolUseBlock,
  logger: FastifyBaseLogger
): Promise<Anthropic.ToolResultBlockParam> {
  const base = { type: 'tool_result' as const, tool_use_id: use.id };
  const tool = CONCIERGE_TOOLS.find((t) => t.name === use.name);
  if (!tool) return { ...base, is_error: true, content: `unknown tool: ${use.name}` };
  try {
    const parsed = tool.input.parse(use.input);
    const result = await tool.call(client, { tenantSlug }, parsed);
    const payload =
      result.meta !== undefined ? { data: result.data, meta: result.meta } : result.data;
    return { ...base, content: JSON.stringify(payload).slice(0, MAX_TOOL_RESULT_CHARS) };
  } catch (err) {
    const message =
      err instanceof StorefrontApiError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    logger.debug({ tool: use.name, err }, 'chat AI: concierge tool failed');
    return { ...base, is_error: true, content: message };
  }
}
