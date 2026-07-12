// Live Chat — widget configuration read/write (docs/56, docs/69 A-1).
//
// Config is a JSON blob on tenant.settings.chat (NOT the module flag, which is
// tenant.settings.modules.chat.enabled). The widget, the AI handler, and the
// dashboard settings page all read through getChatConfig so a missing/partial
// blob always resolves to DEFAULT_CHAT_CONFIG.

import { prisma } from '@sparx/db';
import { encryptProviderSecret } from '@sparx/integration-framework';

import {
  DEFAULT_CHAT_CONFIG,
  AI_PROVIDERS,
  type AiProvider,
  type ChatConfig,
  type ChatConfigPatch,
  type OperatingHours,
} from './types.js';

function isAiProvider(v: unknown): v is AiProvider {
  return typeof v === 'string' && (AI_PROVIDERS as readonly string[]).includes(v);
}

function coerceConfig(raw: unknown): ChatConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CHAT_CONFIG };
  const r = raw as Record<string, unknown>;
  return {
    aiEnabled: typeof r.aiEnabled === 'boolean' ? r.aiEnabled : DEFAULT_CHAT_CONFIG.aiEnabled,
    aiProvider: isAiProvider(r.aiProvider) ? r.aiProvider : null,
    aiApiKeyEncrypted: typeof r.aiApiKeyEncrypted === 'string' ? r.aiApiKeyEncrypted : null,
    collectEmail:
      typeof r.collectEmail === 'boolean' ? r.collectEmail : DEFAULT_CHAT_CONFIG.collectEmail,
    greeting: typeof r.greeting === 'string' ? r.greeting : DEFAULT_CHAT_CONFIG.greeting,
    awayMessage:
      typeof r.awayMessage === 'string' ? r.awayMessage : DEFAULT_CHAT_CONFIG.awayMessage,
    primaryColor: typeof r.primaryColor === 'string' ? r.primaryColor : null,
    primaryColorContent: typeof r.primaryColorContent === 'string' ? r.primaryColorContent : null,
    position: r.position === 'bottom-left' ? 'bottom-left' : 'bottom-right',
    operatingHours: isOperatingHours(r.operatingHours) ? r.operatingHours : null,
  };
}

function isOperatingHours(v: unknown): v is OperatingHours {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Record<string, unknown>).timezone === 'string' &&
    typeof (v as Record<string, unknown>).days === 'object'
  );
}

/** Resolve a tenant's chat widget config, falling back to defaults per-field. */
export async function getChatConfig(tenantId: string): Promise<ChatConfig> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  return coerceConfig(settings.chat);
}

/** Shallow-merge a partial config patch onto the stored blob. `aiApiKey`
 *  (plaintext) is encrypted here before it ever touches storage — omit it to
 *  leave the stored key untouched, pass null to disconnect the tenant's AI
 *  provider entirely. */
export async function updateChatConfig(
  tenantId: string,
  patch: ChatConfigPatch
): Promise<ChatConfig> {
  const { aiApiKey, ...configPatch } = patch;
  const current = await getChatConfig(tenantId);
  const next: ChatConfig = { ...current, ...configPatch };
  if (aiApiKey !== undefined) {
    next.aiApiKeyEncrypted = aiApiKey === null ? null : encryptProviderSecret(aiApiKey);
  }
  // jsonb_set on the `chat` key only — never clobber sibling settings (modules,
  // primaryDomain, onboarding tracker, …). Uses a parameterized jsonb value.
  await prisma.$executeRaw`
    UPDATE tenants
    SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{chat}', ${JSON.stringify(
      next
    )}::jsonb, true)
    WHERE id = ${tenantId}::uuid
  `;
  return next;
}

/**
 * True when the tenant is within an operating-hours window right now (or has no
 * hours configured, i.e. always available). Evaluated in the configured IANA
 * timezone via Intl, so it's DST-correct without pulling a date library.
 */
export function isWithinOperatingHours(config: ChatConfig, now: Date = new Date()): boolean {
  const hours = config.operatingHours;
  if (!hours) return true;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: hours.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
    if (dayIndex < 0) return true;
    const window = hours.days[String(dayIndex)];
    if (!window) return false;
    const nowMinutes = Number(hour) * 60 + Number(minute === '24' ? '00' : minute);
    const [oh = 0, om = 0] = window.open.split(':').map(Number);
    const [ch = 0, cm = 0] = window.close.split(':').map(Number);
    return nowMinutes >= oh * 60 + om && nowMinutes < ch * 60 + cm;
  } catch {
    // Bad timezone string → fail open (treat as available) rather than hide chat.
    return true;
  }
}
