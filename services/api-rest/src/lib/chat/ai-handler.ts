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
import { withTenant } from '@sparx/db';
import type { TenantContext } from '@sparx/db';

import { resolveActivePropertyName } from '../property.js';
import { env } from '../../env.js';
import { conversationService } from './index.js';
import { getChatConfig, isWithinOperatingHours } from './config.js';
import { getChatBroadcaster } from './broadcaster.js';
import { escalateToHuman } from './notify.js';

const MODEL = 'claude-haiku-4-5-20251001';
const CONFIDENCE_THRESHOLD = 0.8;
const HANDOFF_MESSAGE =
  "Thanks! I've passed this along to our team — someone will follow up shortly.";

interface AiDecision {
  answer: string;
  confidence: number;
  escalate: boolean;
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

function buildSystemPrompt(g: GroundingDto): string {
  const catalog = g.products.length
    ? `Products currently sold:\n${g.products.map((p) => `- ${p}`).join('\n')}`
    : 'No product catalog is available.';
  const info = g.pages.length
    ? `Information / policy pages on the site: ${g.pages.join(', ')}.`
    : '';
  return [
    `You are the customer-support assistant for ${g.siteName}, embedded in its storefront chat widget.`,
    'Answer concisely and only from the context below. If the customer asks about an order, account, refund, a specific price, availability, or anything not covered by the context, do NOT guess — set escalate to true so a human takes over.',
    'Always call the `respond` tool. Set confidence between 0 and 1 for how sure you are the answer is correct and grounded. Be honest: low confidence is better than a wrong answer.',
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
    const grounding = await buildGrounding(tenantId);
    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    // Map the thread to Anthropic turns: customer → user, staff/ai → assistant.
    // The thread always opens with the customer's first message, so the
    // sequence already starts on a user turn.
    const turns = messages.map((m) => ({
      role: m.senderType === 'customer' ? ('user' as const) : ('assistant' as const),
      content: m.body,
    }));

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: buildSystemPrompt(grounding),
      messages: turns,
      tools: [
        {
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
        },
      ],
      tool_choice: { type: 'tool', name: 'respond' },
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (toolUse?.type !== 'tool_use') return null;
    const input = toolUse.input as Partial<AiDecision>;
    if (typeof input.answer !== 'string' || typeof input.confidence !== 'number') return null;
    return {
      answer: input.answer,
      confidence: Math.max(0, Math.min(1, input.confidence)),
      escalate: input.escalate === true,
    };
  } catch (err) {
    logger.error({ err }, 'chat AI: Anthropic call failed');
    return null;
  }
}
