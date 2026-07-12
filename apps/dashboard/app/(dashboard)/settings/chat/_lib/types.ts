// Live Chat settings — DTO mirror (docs/69 A-5).

/** LLM providers a tenant may bring their own key for. sparx never runs its
 *  own AI — every chat AI reply uses the connecting tenant's own key. */
export type AiProvider = 'anthropic' | 'openai';

export interface ChatConfig {
  aiEnabled: boolean;
  /** The tenant's own AI provider — null until they connect one. */
  aiProvider: AiProvider | null;
  /** Whether a key is currently stored — the key itself is never sent to the
   *  client. See `ChatConfigPatch.aiApiKey` to set/clear it. */
  aiKeyConfigured: boolean;
  collectEmail: boolean;
  greeting: string;
  awayMessage: string;
  primaryColor: string | null;
  /** The legible "on primaryColor" color paired with it — see theme-colors.ts. */
  primaryColorContent: string | null;
  position: 'bottom-right' | 'bottom-left';
  operatingHours: {
    timezone: string;
    days: Record<string, { open: string; close: string } | null>;
  } | null;
}

/** Write shape for `updateChatSettingsAction` — everything from `ChatConfig`
 *  except the read-only `aiKeyConfigured`, plus the write-only `aiApiKey`
 *  (plaintext, encrypted server-side; omit to leave the stored key
 *  untouched, pass null to disconnect the provider). */
export type ChatConfigPatch = Partial<Omit<ChatConfig, 'aiKeyConfigured'>> & {
  aiApiKey?: string | null;
};

export interface QuickReplyDto {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  createdAt: string;
  updatedAt: string;
}
