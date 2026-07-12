// Tenant-BYOK LLM routing (docs/07). sparx never holds a platform-level AI
// credential — every LLM call is made with the connecting tenant's OWN
// provider + key, via llm-harness (github.com/brandonkorous/llm-harness), so
// a tenant can bring Anthropic or OpenAI without sparx running any AI of its
// own. Callers build a fresh router per-request from the tenant's decrypted
// key; nothing here is cached across tenants.

import { createRouter, type Router } from 'llm-harness';

import type { AiProvider } from '../chat/types.js';

/** Sane default model per provider — cheap, fast, tool-calling-capable. A
 *  tenant can't currently override this (kept out of the settings UI to
 *  avoid exposing model-name jargon to a non-technical audience). */
export const DEFAULT_MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
};

/** Build a router scoped to exactly one tenant-supplied provider + key. The
 *  `models` route pins the default model to that provider explicitly, so
 *  there's no ambiguity from llm-harness's model-name auto-detection. */
export function createTenantLlmRouter(provider: AiProvider, apiKey: string): Router {
  const model = DEFAULT_MODEL_BY_PROVIDER[provider];
  return createRouter({
    providers: { [provider]: { apiKey } },
    models: { [model]: provider },
  });
}

/** Attempt a trivial completion to confirm a tenant-pasted key actually
 *  authenticates with the provider, before it's encrypted and stored. Never
 *  throws — callers branch on the returned ok/error. */
export async function verifyAiProviderKey(
  provider: AiProvider,
  apiKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const router = createTenantLlmRouter(provider, apiKey);
    await router.complete({
      model: DEFAULT_MODEL_BY_PROVIDER[provider],
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 1,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeProviderError(err) };
  }
}

function describeProviderError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/401|invalid.?api.?key|unauthorized|authentication/i.test(message)) {
    return "That key was rejected — double-check you copied it correctly and that it's active.";
  }
  if (/429|rate.?limit/i.test(message)) {
    return 'That key works, but the provider is rate-limiting it right now — try saving again in a moment.';
  }
  return "We couldn't connect using that key. Check that it's correct and has available credits.";
}
