// The platform's default AI prompt library — installed by the `ai` module preset
// (and referenced by every industry starter). Cross-industry, production-ready
// prompts a tenant can use verbatim or adapt: a chat persona, plus reusable
// authoring prompts for product copy, lifecycle email, support, SEO, social, and
// review responses.
//
// Data-as-code (line-limit exempt). Keys are stable kebab-case slugs — the install
// is ensure-by-key (idempotent), so editing a body here does NOT overwrite a
// tenant's edited copy; it only affects tenants that don't yet have that key.
//
// `{{variable}}` placeholders are filled by the consuming flow / the staff member.
// The `persona` entry is special: the live-chat first-responder reads the active
// enabled persona to ground its system prompt (wizeworks/services/api-rest/src/lib/chat).

import type { PromptCategory, PromptVariable } from './types.js';

export interface PromptTemplateSeed {
  key: string;
  name: string;
  description: string;
  category: PromptCategory;
  body: string;
  variables: PromptVariable[];
  model?: string;
}

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplateSeed[] = [
  {
    key: 'support-persona',
    name: 'Support assistant persona',
    description:
      'The voice + guardrails for your storefront chat assistant. The live-chat AI reads the active enabled persona to ground every reply.',
    category: 'persona',
    body: [
      'You are the customer-support assistant for {{business_name}}, embedded in its storefront chat.',
      '',
      'Voice: warm, concise, and genuinely helpful — never pushy. Write the way a knowledgeable shop owner talks: plain language, short sentences, no corporate filler.',
      '',
      'Rules:',
      '- Answer ONLY from the context you are given (catalog, pages, policies). Never invent prices, stock, order details, or policies.',
      '- If a question needs account-specific data (an order, a refund, an exact price/availability) or anything not in the context, hand off to a human instead of guessing.',
      '- Prefer one clear next step over a wall of options.',
      '- Match the customer’s language and tone; stay professional even if they are frustrated.',
    ].join('\n'),
    variables: [{ key: 'business_name', label: 'Business name', example: 'Northwind Coffee Co.' }],
  },
  {
    key: 'product-description',
    name: 'Product description writer',
    description: 'Turns a few bullet points into a polished, benefit-led product description.',
    category: 'product',
    body: [
      'Write a product description for "{{product_name}}".',
      '',
      'Key features / details:',
      '{{key_features}}',
      '',
      'Audience: {{audience}}',
      'Tone: {{tone}}',
      '',
      'Lead with the customer benefit, not the spec. 2 short paragraphs, then a 3–5 item bullet list of concrete features. Avoid hype words ("revolutionary", "game-changing"). End with one practical line about who it’s for or how it’s used.',
    ].join('\n'),
    variables: [
      { key: 'product_name', label: 'Product name', example: 'Cold Brew Concentrate' },
      { key: 'key_features', label: 'Key features (one per line)' },
      { key: 'audience', label: 'Audience', example: 'busy home baristas' },
      { key: 'tone', label: 'Tone', example: 'friendly, confident' },
    ],
  },
  {
    key: 'win-back-email',
    name: 'Win-back email',
    description: 'Re-engages a lapsed customer with a warm, low-pressure nudge and an incentive.',
    category: 'email',
    body: [
      'Write a short win-back email to {{customer_name}}, who last purchased {{last_purchase}}.',
      '',
      'Offer: {{incentive}}',
      '',
      'Keep it under 120 words. Open by acknowledging it’s been a while (no guilt). One clear reason to come back + the offer. Friendly subject line (under 50 characters) and a single call to action. Sign off as {{business_name}}.',
    ].join('\n'),
    variables: [
      { key: 'customer_name', label: 'Customer name', example: 'Jordan' },
      { key: 'last_purchase', label: 'Last purchase', example: '3 months ago' },
      { key: 'incentive', label: 'Incentive', example: '15% off your next order' },
      { key: 'business_name', label: 'Business name' },
    ],
  },
  {
    key: 'welcome-email',
    name: 'Welcome email',
    description: 'Greets a new customer and sets expectations for what comes next.',
    category: 'email',
    body: [
      'Write a welcome email for {{customer_name}}, who just created an account / placed their first order with {{business_name}}.',
      '',
      'Warm, brief (under 130 words). Thank them, set one expectation (shipping, what to explore, how to get help), and point to {{next_step}}. Friendly subject line. No discount unless one is provided.',
    ].join('\n'),
    variables: [
      { key: 'customer_name', label: 'Customer name' },
      { key: 'business_name', label: 'Business name' },
      { key: 'next_step', label: 'Next step', example: 'browse the new-arrivals collection' },
    ],
  },
  {
    key: 'support-reply',
    name: 'Support reply draft',
    description: 'Drafts an on-brand reply to a customer support message.',
    category: 'support',
    body: [
      'Draft a reply to this customer message:',
      '"{{customer_message}}"',
      '',
      'Relevant context: {{context}}',
      '',
      'Be empathetic and specific. Acknowledge the issue, give the concrete answer or next step, and set a clear expectation (timing). Keep it under 120 words. If you’re missing information needed to resolve it, ask exactly one clarifying question.',
    ].join('\n'),
    variables: [
      { key: 'customer_message', label: 'Customer message' },
      {
        key: 'context',
        label: 'Context',
        example: 'Order shipped 2 days ago, tracking shows in transit',
      },
    ],
  },
  {
    key: 'seo-meta',
    name: 'SEO title + meta description',
    description: 'Generates a search-optimized page title and meta description.',
    category: 'seo',
    body: [
      'Write an SEO title and meta description for a page about: {{page_topic}}.',
      '',
      'Primary keywords: {{keywords}}',
      'Brand: {{business_name}}',
      '',
      'Title ≤ 60 characters, leads with the primary keyword, ends with the brand. Meta description ≤ 155 characters, written for a human (a clear benefit + a reason to click), not keyword-stuffed. Return them on two labeled lines.',
    ].join('\n'),
    variables: [
      { key: 'page_topic', label: 'Page topic', example: 'organic cold brew subscription' },
      { key: 'keywords', label: 'Primary keywords' },
      { key: 'business_name', label: 'Brand' },
    ],
  },
  {
    key: 'social-post',
    name: 'Social post',
    description: 'Writes a short, platform-appropriate social post with a call to action.',
    category: 'social',
    body: [
      'Write a {{platform}} post about: {{topic}}.',
      '',
      'Tone: {{tone}}. Link: {{link}}',
      '',
      'Hook in the first line. Keep it tight (platform-appropriate length). One clear call to action. Add 2–4 relevant hashtags only if natural for the platform. No emoji spam — one or two at most.',
    ].join('\n'),
    variables: [
      { key: 'platform', label: 'Platform', example: 'Instagram' },
      { key: 'topic', label: 'Topic' },
      { key: 'tone', label: 'Tone', example: 'playful' },
      { key: 'link', label: 'Link', example: 'https://…' },
    ],
  },
  {
    key: 'review-response',
    name: 'Review response',
    description: 'Drafts a gracious public response to a customer review.',
    category: 'crm',
    body: [
      'Draft a public response to this {{rating}}-star review from a customer of {{business_name}}:',
      '"{{review_text}}"',
      '',
      'Thank them by name if available. For positive reviews, be warm and specific (reference what they liked). For critical reviews, take responsibility without being defensive, and offer to make it right offline. Keep it under 80 words. Never argue or share private details publicly.',
    ].join('\n'),
    variables: [
      { key: 'rating', label: 'Rating (1–5)' },
      { key: 'review_text', label: 'Review text' },
      { key: 'business_name', label: 'Business name' },
    ],
  },
];
