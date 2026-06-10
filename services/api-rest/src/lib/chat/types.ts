// Live Chat — shared domain types + Zod input schemas (docs/56, docs/69 A-1).
//
// The chat backend lives in api-rest (routes are thin wrappers over the
// services in this folder). Service functions throw `@sparx/api-core` ApiError
// so the envelope plugin renders the canonical error shape — no bespoke mapper.

import { z } from 'zod';

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'spam';
export type SenderType = 'customer' | 'staff' | 'ai';
export type ChatSource = 'storefront' | 'sparx_market' | 'dashboard';

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
  /** AI auto-responds to inbound storefront messages when true. */
  aiEnabled: boolean;
  /** Show a name/email pre-chat form to anonymous visitors before the thread. */
  collectEmail: boolean;
  /** Auto-greeting inserted as the first AI/system message when a thread opens. */
  greeting: string;
  /** Shown instead of the composer when outside operating hours. */
  awayMessage: string;
  /** Overrides the storefront `--sf-accent` for the bubble/panel. */
  primaryColor: string | null;
  position: 'bottom-right' | 'bottom-left';
  /** null = always available (no away state). */
  operatingHours: OperatingHours | null;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  aiEnabled: true,
  collectEmail: true,
  greeting: 'Hi! 👋 How can we help?',
  awayMessage: "We're away right now, but leave a message and we'll get back to you.",
  primaryColor: null,
  position: 'bottom-right',
  operatingHours: null,
};

const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24-hour)');

export const OperatingHoursSchema = z.object({
  timezone: z.string().min(1).max(64),
  days: z.record(z.string(), z.union([z.object({ open: TimeOfDay, close: TimeOfDay }), z.null()])),
});

export const ChatConfigSchema = z.object({
  aiEnabled: z.boolean(),
  collectEmail: z.boolean(),
  greeting: z.string().max(500),
  awayMessage: z.string().max(500),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB hex color')
    .nullable(),
  position: z.enum(['bottom-right', 'bottom-left']),
  operatingHours: OperatingHoursSchema.nullable(),
});

export const ChatConfigPatchSchema = ChatConfigSchema.partial();

// ─── Conversation / message inputs ──────────────────────────────────────────

export const CreateConversationInput = z.object({
  customerId: z.string().uuid().optional(),
  subject: z.string().max(255).optional(),
  source: z.enum(['storefront', 'sparx_market', 'dashboard']).optional(),
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
