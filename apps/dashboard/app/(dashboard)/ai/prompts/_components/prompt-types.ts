// Shared shapes + display vocabulary for the prompt-template library. The DTO
// mirrors the api-rest contract (/v1/ai/prompt-templates); the category list is
// the closed set the backend validates against, with `persona` deliberately
// first — the storefront chat assistant grounds its voice on the active enabled
// persona template, so it leads the library.

export type PromptCategory =
  | 'persona'
  | 'support'
  | 'email'
  | 'product'
  | 'seo'
  | 'social'
  | 'crm'
  | 'general';

export interface PromptVariable {
  key: string;
  label: string;
  example?: string;
}

export interface PromptTemplateDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: PromptCategory;
  body: string;
  variables: PromptVariable[];
  model: string | null;
  enabled: boolean;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

// Category → display label + one-line meaning. Persona leads (see file header);
// the rest follow in a stable, scannable order. Used by the grouped list and the
// create/edit category picker so the two never drift.
export const PROMPT_CATEGORIES: { value: PromptCategory; label: string; blurb: string }[] = [
  {
    value: 'persona',
    label: 'Persona',
    blurb: 'The active enabled persona is the voice your storefront chat assistant speaks in.',
  },
  { value: 'support', label: 'Support', blurb: 'Help-desk replies and customer-care answers.' },
  { value: 'email', label: 'Email', blurb: 'Drafting for campaigns and transactional copy.' },
  { value: 'product', label: 'Product', blurb: 'Descriptions, titles, and merchandising copy.' },
  { value: 'seo', label: 'SEO', blurb: 'Meta titles, descriptions, and search summaries.' },
  { value: 'social', label: 'Social', blurb: 'Posts and captions for social channels.' },
  { value: 'crm', label: 'CRM', blurb: 'Outreach, follow-ups, and relationship notes.' },
  { value: 'general', label: 'General', blurb: 'Reusable prompts that span every workflow.' },
];

const CATEGORY_LABELS: Record<PromptCategory, string> = Object.fromEntries(
  PROMPT_CATEGORIES.map((c) => [c.value, c.label])
) as Record<PromptCategory, string>;

export function categoryLabel(category: PromptCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

// The closed category order for grouping — drives section sequence on the list.
export const CATEGORY_ORDER: PromptCategory[] = PROMPT_CATEGORIES.map((c) => c.value);

// Lowercase kebab-case, matching the backend's `^[a-z0-9][a-z0-9-]*$`. Surfaced
// in the create form so a bad key is caught before the round-trip (the server
// still validates + de-dupes per tenant, returning 409 on a collision).
export const KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidPromptKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

// Best-effort key suggestion from a name: lowercase, non-alphanumerics → hyphens,
// collapsed and trimmed. The field stays editable; this just saves typing.
export function suggestKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
