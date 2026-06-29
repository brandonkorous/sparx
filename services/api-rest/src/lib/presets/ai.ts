// AI module presets — the starter prompt library (docs/07 §9).
//
// Like the cms/scheduling/email presets, these live at the api-rest composition
// root (there is no `@sparx/ai` package — the AI domain logic is a set of api-rest
// lib services). The single preset installs the platform-default prompt library
// (ensure-by-key, idempotent) into an already-enabled `ai` module. Industry
// starters reference it so picking a vertical with AI on seeds the prompts too.
//
// Data-as-code (line-limit exempt).

import { definePreset, type ModulePreset } from '@sparx/auth';
import type { TenantContext } from '@sparx/db';

import { DEFAULT_PROMPT_TEMPLATES } from '../ai/default-prompts.js';
import { ensureDefaultPromptTemplates } from '../ai/prompt-templates.js';

// The marker key — installed ⇔ the persona prompt exists (the sentinel for the set).
const SENTINEL_KEY = 'support-persona';
const authoringCount = DEFAULT_PROMPT_TEMPLATES.length - 1; // minus the persona

const promptLibraryPreset: ModulePreset = definePreset({
  module: 'ai',
  slug: 'ai-prompt-library-core',
  kind: 'ai-prompts',
  name: 'Starter prompt library',
  description:
    'A ready-to-use AI prompt library: a storefront support-assistant persona plus reusable prompts for product copy, lifecycle email, support replies, SEO, social, and review responses. Edit any of them; the chat assistant reads the active persona.',
  iconKey: 'sparkles',
  tags: ['ai', 'prompts', 'assistant', 'persona'],
  summary: [
    { label: `${DEFAULT_PROMPT_TEMPLATES.length} prompts`, tone: 'module' },
    { label: `Persona + ${authoringCount} authoring prompts`, tone: 'neutral' },
  ],
  marker: (tx, tenantId) =>
    tx.aiPromptTemplate
      .findFirst({ where: { tenantId, key: SENTINEL_KEY }, select: { id: true } })
      .then(Boolean),
  build: async (sx: TenantContext) => {
    await ensureDefaultPromptTemplates(sx);
    // Return the persona id so callers can deep-link to what was installed.
    const persona = await sx.tx!.aiPromptTemplate.findFirst({
      where: { key: SENTINEL_KEY },
      select: { id: true },
    });
    return { id: persona?.id ?? sx.tenantId };
  },
});

/** Every AI module preset, in picker order. */
export const aiPresets: ModulePreset[] = [promptLibraryPreset];
