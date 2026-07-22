// Live Chat — AI first-responder (docs/56, docs/69 A-3).
//
// Invoked fire-and-forget after a customer message is persisted (public REST +
// WebSocket paths). It answers product/policy questions and escalates to a
// human when unsure, outside operating hours, or when AI is off.
// Escalation publishes `chat.message.received` so the notification fallbacks
// (email-worker + web push, A-6) can alert staff.
//
// sparx never holds a platform-level AI credential — every call here runs
// against the TENANT's own provider + key (Anthropic or OpenAI, brought in
// Settings → Chat), decrypted just-in-time via llm-harness
// (github.com/brandonkorous/llm-harness), which normalizes tool calling
// across providers. No key configured → the bot stands down entirely and a
// human handles it, same as AI being turned off.
//
// Grounding context comes from the tenant's own catalog + published pages via
// RLS — not Typesense — because per-tenant Typesense reindex isn't live yet
// (see memory project_typesense_build_progress). Swap in Typesense retrieval
// here once it is, without touching callers.

import type { FastifyBaseLogger } from 'fastify';
import { withTenant, prisma } from '@sparx/db';
import type { TenantContext } from '@sparx/db';
import { decryptProviderSecret } from '@sparx/integration-framework';
import { isModuleEnabled } from '@sparx/auth';
import type { Message, ToolCall, ToolDefinition, ToolParameter } from 'llm-harness';
import { SITE_TOOLS, toAnthropicTools, SiteApiClient, SiteApiError } from '@sparx/site-mcp';

import { resolveActivePropertyName, resolvePrimaryPropertyId } from '../property.js';
import { getActivePersona } from '../ai/prompt-templates.js';
import { resolveAiProviderCredential } from '../ai/credentials.js';
import { createTenantLlmRouter, DEFAULT_MODEL_BY_PROVIDER } from '../ai/llm-router.js';
import { env } from '../../env.js';
import { conversationService } from './index.js';
import { getChatConfig, isWithinOperatingHours } from './config.js';
import { getChatBroadcaster } from './broadcaster.js';
import { escalateToHuman } from './notify.js';
import type { AiProvider } from './types.js';

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
const CONCIERGE_TOOLS = SITE_TOOLS.filter((t) => t.kind === 'read');

const RESPOND_TOOL: ToolDefinition = {
  name: 'respond',
  description: 'Respond to the customer or escalate the conversation to a human agent.',
  parameters: {
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
  },
};

// respond + the read lookup tools. llm-harness has no cross-provider way to
// FORCE a tool call, so the system prompt instructs the model to always
// finish with `respond` — enforced by prompt, not the API (see buildSystemPrompt).
const TOOL_DEFS: ToolDefinition[] = [
  ...toAnthropicTools(CONCIERGE_TOOLS).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema as unknown as ToolParameter,
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
    // The AI first-responder is a capability of the `ai` module, NOT of Live
    // Chat. Live Chat ($19) buys the widget, routing, and the human inbox; the
    // intelligence layer — this concierge AND the MCP server — is the one `ai`
    // module. Without it, chat still works, every conversation just goes to a
    // person. (This gate was missing: the concierge shipped unlocked by chat
    // alone, giving away an `ai` module capability at the chat price.)
    if (!(await isModuleEnabled(ctx.tenantId, 'ai'))) {
      await escalateToHuman(ctx, conversationId, logger, 'ai_disabled');
      return;
    }

    const config = await getChatConfig(ctx.tenantId);

    // The provider + key come from the tenant's account-wide AI credential
    // (Settings → AI connections) first, falling back to a legacy chat-scoped
    // key for tenants that connected before the credential moved to the
    // account. Either way sparx holds no key of its own.
    const platformCredential = await resolveAiProviderCredential(ctx.tenantId);
    const provider: AiProvider | null = platformCredential?.provider ?? config.aiProvider;
    const apiKey =
      platformCredential?.apiKey ??
      (config.aiApiKeyEncrypted ? decryptProviderSecret(config.aiApiKeyEncrypted) : null);

    // AI enabled, but the tenant hasn't connected their own provider + key
    // yet → a human must handle it. sparx has no fallback credential.
    if (!config.aiEnabled || !provider || !apiKey) {
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

    const decision = await askAssistant(
      ctx.tenantId,
      // The site this conversation is on decides which business the assistant
      // believes it works for (docs/131 §3.5 + §3.7). Null only for a
      // dashboard-sourced thread, where a tenant-wide persona is correct.
      conversation.propertyId ?? null,
      provider,
      apiKey,
      conversation.messages,
      logger
    );
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

async function buildGrounding(tenantId: string, propertyId: string | null): Promise<GroundingDto> {
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
        // Ground on THIS site's pages plus any tenant-wide ones (docs/131 §4) —
        // the AI answering on the donut storefront must not cite the machine
        // shop's pages. (Product grounding above is still tenant-wide; scoping it
        // needs the ProductProperty visibility join, a broader change tracked
        // with the product-visibility P1 work.)
        where: {
          status: 'published',
          ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
        },
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
  // confidence + escalation are wired to the caller's parsing and must not be
  // overridable.
  const intro = persona
    ? persona.replace(/\{\{\s*business_name\s*\}\}/g, g.siteName)
    : [
        `You are the customer-support assistant for ${g.siteName}, embedded in its storefront chat widget.`,
        'Answer concisely and only from the context below. If the customer asks about an order, account, refund, a specific price, availability, or anything not covered by the context, do NOT guess.',
      ].join('\n\n');
  return [
    intro,
    'You have lookup tools — use them to fetch real products, prices, availability, services, and store info before answering; never guess specifics. When you have what you need (or determine you cannot answer), you MUST call the `respond` tool — never answer in plain text, even for a simple question. Set confidence between 0 and 1 for how sure you are the answer is correct and grounded — be honest, low confidence beats a wrong answer. For order/account/refund specifics, or anything the tools cannot resolve, set escalate to true so a human takes over.',
    catalog,
    info,
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function askAssistant(
  tenantId: string,
  propertyId: string | null,
  provider: AiProvider,
  apiKey: string,
  messages: { senderType: string; body: string }[],
  logger: FastifyBaseLogger
): Promise<AiDecision | null> {
  try {
    const [grounding, persona, tenantSlug] = await Promise.all([
      buildGrounding(tenantId, propertyId),
      // A conversation with no site (staff-to-staff in the dashboard) still gets
      // the tenant-wide persona, which getActivePersona resolves when handed the
      // primary. A customer-facing thread always has one — the CHECK constraint
      // on chat_conversations makes the alternative unrepresentable.
      propertyId
        ? getActivePersona(tenantId, propertyId)
        : resolvePrimaryPropertyId(tenantId).then((id) => getActivePersona(tenantId, id)),
      resolveTenantSlug(tenantId),
    ]);
    if (!tenantSlug) return null; // can't scope tool calls without the tenant slug

    const router = createTenantLlmRouter(provider, apiKey);
    // The concierge calls the storefront's OWN public API — the same routes the
    // shopper MCP uses — over a loopback call. One execution path, real parity.
    const client = new SiteApiClient(`http://127.0.0.1:${env.PORT}`, { tenantSlug });

    // Map the thread to unified llm-harness turns: customer → user, staff/ai →
    // assistant. The thread always opens with the customer's first message, so
    // it starts on a user turn; the tool loop appends assistant tool_use +
    // tool-role result messages.
    const convo: Message[] = messages.map((m) => ({
      role: m.senderType === 'customer' ? ('user' as const) : ('assistant' as const),
      content: m.body,
    }));

    const model = DEFAULT_MODEL_BY_PROVIDER[provider];
    const system = buildSystemPrompt(grounding, persona?.body ?? null);

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const response = await router.complete({
        model,
        maxTokens: 1024,
        system,
        messages: convo,
        tools: TOOL_DEFS,
      });

      const respondCall = response.toolCalls.find((c) => c.name === 'respond');
      if (respondCall) return parseDecision(safeJsonParse(respondCall.arguments));

      if (response.toolCalls.length === 0) {
        // No forced tool_choice across providers (llm-harness has no unified
        // equivalent) — the model answered in plain text instead of calling
        // `respond`. Treat it as unvetted (no confidence/groundedness signal)
        // so it always escalates rather than reaching the customer unchecked.
        if (response.text.trim()) {
          logger.warn({ tenantId, provider }, 'chat AI: model replied without calling respond');
          return { answer: response.text.trim(), confidence: 0, escalate: true };
        }
        return null;
      }

      // Execute the lookup tools this turn and feed results back for the next.
      convo.push({
        role: 'assistant',
        content: response.toolCalls.map((c) => ({
          type: 'tool_use' as const,
          id: c.id,
          name: c.name,
          arguments: safeJsonParse(c.arguments),
        })),
      });
      for (const call of response.toolCalls) {
        convo.push(await runConciergeTool(client, tenantSlug, call, logger));
      }
    }

    logger.warn({ tenantId, provider }, 'chat AI: tool loop hit the turn cap without responding');
    return null;
  } catch (err) {
    logger.error({ err, provider }, 'chat AI: provider call failed');
    return null;
  }
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
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

/** Run one concierge lookup tool and shape it as a `tool`-role result message.
 *  A failed lookup becomes an error string the model can see and route around
 *  — it never throws out of the loop. */
async function runConciergeTool(
  client: SiteApiClient,
  tenantSlug: string,
  call: ToolCall,
  logger: FastifyBaseLogger
): Promise<Message> {
  const tool = CONCIERGE_TOOLS.find((t) => t.name === call.name);
  if (!tool) {
    return { role: 'tool', toolCallId: call.id, content: `Error: unknown tool ${call.name}` };
  }
  try {
    const parsed = tool.input.parse(safeJsonParse(call.arguments));
    const result = await tool.call(client, { tenantSlug }, parsed);
    const payload =
      result.meta !== undefined ? { data: result.data, meta: result.meta } : result.data;
    return {
      role: 'tool',
      toolCallId: call.id,
      content: JSON.stringify(payload).slice(0, MAX_TOOL_RESULT_CHARS),
    };
  } catch (err) {
    const message =
      err instanceof SiteApiError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    logger.debug({ tool: call.name, err }, 'chat AI: concierge tool failed');
    return { role: 'tool', toolCallId: call.id, content: `Error: ${message}` };
  }
}
