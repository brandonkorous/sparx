// AI accounts' entry in the shared integration plane (@wizeworks/integrations).
//
// The catalog face for BYOK: the tenant's OWN Anthropic or OpenAI account, which is
// the only credential any AI feature in sparx ever runs on. Registering it here is
// what puts "connect your AI account" in the same list as connecting a card processor
// or a carrier, instead of on a separate screen a tenant has to already know about.
//
// Descriptor-only by design. There is no adapter to dispatch: a BYOK key is verified
// against the provider and stored encrypted, and the AI features read it directly —
// the plane models that as an entry with no adapter rather than inventing one.
//
// The MCP side of AI connections is deliberately NOT here. Those point the other way
// — an outside AI app connecting IN to this tenant's data — so they are inbound
// grants, not outside services the business connects to. Listing them beside carriers
// and processors would put two opposite directions of trust under one heading.

import { defineIntegrationKind, type IntegrationDescriptor } from '@wizeworks/integrations';

import { AI_PROVIDERS, type AiProvider } from '../chat/types.js';

/** Typed on `never` — this category has no adapter contract, and saying so is more
 *  honest than picking a type nothing implements. */
export const aiIntegrations = defineIntegrationKind<never>('ai');

interface AiVendorCopy {
  name: string;
  vendor: string;
  blurb: string;
  keyHelp: string;
  placeholder: string;
  docsUrl: string;
}

const COPY: Record<AiProvider, AiVendorCopy> = {
  anthropic: {
    name: 'Anthropic',
    vendor: 'Anthropic',
    blurb:
      'Use your own Anthropic account to power the AI features in sparx — writing product descriptions, drafting emails, answering questions about your business.',
    keyHelp: 'Anthropic Console → Settings → API keys.',
    placeholder: 'sk-ant-…',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    name: 'OpenAI',
    vendor: 'OpenAI',
    blurb:
      'Use your own OpenAI account to power the AI features in sparx — writing product descriptions, drafting emails, answering questions about your business.',
    keyHelp: 'OpenAI dashboard → API keys.',
    placeholder: 'sk-…',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
};

export function aiProviderDescriptor(provider: AiProvider): IntegrationDescriptor {
  const copy = COPY[provider];
  return {
    category: 'ai',
    slug: provider,
    name: copy.name,
    vendor: copy.vendor,
    blurb: copy.blurb,
    publisher: 'sparx',
    availability: 'available',
    connect: 'api_keys',
    credentialFields: [
      {
        key: 'apiKey',
        label: 'API key',
        help: copy.keyHelp,
        placeholder: copy.placeholder,
        secret: true,
        required: true,
        type: 'password',
      },
    ],
    capabilities: [
      'Writes product and page copy',
      'Answers questions about your own data',
      'You are billed by them directly, not by sparx',
    ],
    docsUrl: copy.docsUrl,
  };
}

/** Publish every BYOK provider into the shared plane. */
export function registerAiIntegrations(): void {
  for (const provider of AI_PROVIDERS) {
    aiIntegrations.register(aiProviderDescriptor(provider));
  }
}
