// Live Chat — shared domain types + Zod input schemas (docs/56, docs/69 A-1).
//
// The chat backend lives in api-rest (routes are thin wrappers over the
// services in this folder). Service functions throw `@sparx/api-core` ApiError
// so the envelope plugin renders the canonical error shape — no bespoke mapper.

import { z } from 'zod';

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'spam';
export type SenderType = 'customer' | 'staff' | 'ai';
export type ChatSource = 'site' | 'sparx_market' | 'dashboard';

/** LLM providers a tenant may bring their own key for (docs/07, chat AI
 *  first-responder). sparx never holds a platform-level AI credential —
 *  every AI call is made with the connecting TENANT's own key. */
export type AiProvider = 'anthropic' | 'openai';
export const AI_PROVIDERS: readonly AiProvider[] = ['anthropic', 'openai'];

/** First value that is neither null/undefined nor an empty string, else null.
 *  Used for "name → company → email" display fallbacks where `??` is wrong
 *  (an empty trimmed name must fall through, not win). */
export function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (v != null && v !== '') return v;
  }
  return null;
}

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  'open',
  'pending',
  'resolved',
  'spam',
];

// ─── Widget configuration (stored at tenant.settings.chat) ──────────────────

export interface OperatingHours {
  /** IANA timezone the windows below are evaluated in (e.g. "America/Los_Angeles"). */
  timezone: string;
  /** Per-weekday open/close windows, 0 = Sunday … 6 = Saturday. null = closed that day. */
  days: Record<string, { open: string; close: string } | null>;
}

export interface ChatConfig {
  /** AI auto-responds to inbound storefront messages when true — only takes
   *  effect once the tenant has configured their own provider + key below. */
  aiEnabled: boolean;
  /** The tenant's own AI provider — null until they connect one. */
  aiProvider: AiProvider | null;
  /** AES-256-GCM ciphertext (`@sparx/integration-framework`'s provider-secret
   *  box), `enc:iv.tag.cipher`. SERVER-INTERNAL ONLY — never serialize this
   *  field to a client; routes must go through `toPublicChatConfig`. */
  aiApiKeyEncrypted: string | null;
  /** Show a name/email pre-chat form to anonymous visitors before the thread. */
  collectEmail: boolean;
  /** Auto-greeting inserted as the first AI/system message when a thread opens. */
  greeting: string;
  /** Shown instead of the composer when outside operating hours. */
  awayMessage: string;
  /** Overrides the storefront `--st-accent` for the bubble/panel. */
  primaryColor: string | null;
  /** The legible "on primaryColor" text/icon color paired with it — carried over
   *  from the matching brand/theme role when the dashboard picker's color came
   *  from a theme swatch, else a computed black/white. null when primaryColor
   *  is null, or for a config saved before this field existed (the widget then
   *  derives its own black/white from primaryColor). */
  primaryColorContent: string | null;
  position: 'bottom-right' | 'bottom-left';
  /** null = always available (no away state). */
  operatingHours: OperatingHours | null;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  aiEnabled: false,
  aiProvider: null,
  aiApiKeyEncrypted: null,
  collectEmail: true,
  greeting: 'Hi! 👋 How can we help?',
  awayMessage: "We're away right now, but leave a message and we'll get back to you.",
  primaryColor: null,
  primaryColorContent: null,
  position: 'bottom-right',
  operatingHours: null,
};

/** Client-safe projection of {@link ChatConfig} — the encrypted key ciphertext
 *  is replaced with a boolean. Every route that returns chat config to the
 *  dashboard or widget MUST send this shape, never the raw `ChatConfig`. */
export type ChatConfigPublic = Omit<ChatConfig, 'aiApiKeyEncrypted'> & {
  aiKeyConfigured: boolean;
};

export function toPublicChatConfig(config: ChatConfig): ChatConfigPublic {
  const { aiApiKeyEncrypted, ...rest } = config;
  return { ...rest, aiKeyConfigured: aiApiKeyEncrypted !== null };
}

const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24-hour)');

export const OperatingHoursSchema = z.object({
  timezone: z.string().min(1).max(64),
  days: z.record(z.string(), z.union([z.object({ open: TimeOfDay, close: TimeOfDay }), z.null()])),
});

export const ChatConfigSchema = z.object({
  aiEnabled: z.boolean(),
  aiProvider: z.enum(AI_PROVIDERS).nullable(),
  collectEmail: z.boolean(),
  greeting: z.string().max(500),
  awayMessage: z.string().max(500),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB hex color')
    .nullable(),
  primaryColorContent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB hex color')
    .nullable(),
  position: z.enum(['bottom-right', 'bottom-left']),
  operatingHours: OperatingHoursSchema.nullable(),
});

export const ChatConfigPatchSchema = ChatConfigSchema.partial().extend({
  /** Plaintext AI provider key pasted by the tenant — encrypted server-side
   *  before it ever reaches storage (never send/store ciphertext from here).
   *  Omit to leave the stored key untouched; pass null to disconnect it. */
  aiApiKey: z.string().min(1).max(500).nullable().optional(),
});

export type ChatConfigPatch = z.infer<typeof ChatConfigPatchSchema>;

// ─── Conversation / message inputs ──────────────────────────────────────────

export const CreateConversationInput = z.object({
  customerId: z.string().uuid().optional(),
  subject: z.string().max(255).optional(),
  source: z.enum(['site', 'sparx_market', 'dashboard']).optional(),
  visitorName: z.string().max(255).optional(),
  visitorEmail: z.string().email().max(255).optional(),
  /** Optional opening message body (staff- or visitor-initiated). */
  message: z.string().min(1).max(8000).optional(),
});

export const UpdateConversationInput = z
  .object({
    status: z.enum(['open', 'pending', 'resolved', 'spam']).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    subject: z.string().max(255).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

export const PostMessageInput = z.object({
  body: z.string().min(1).max(8000),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        name: z.string().max(255),
        contentType: z.string().max(127),
      })
    )
    .max(10)
    .optional(),
});

export const CreateQuickReplyInput = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(8000),
  shortcut: z.string().max(50).optional(),
});

export type CreateConversationInputT = z.infer<typeof CreateConversationInput>;
export type UpdateConversationInputT = z.infer<typeof UpdateConversationInput>;
export type PostMessageInputT = z.infer<typeof PostMessageInput>;
export type CreateQuickReplyInputT = z.infer<typeof CreateQuickReplyInput>;
