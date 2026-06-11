// integration.ts — the payload for an INTEGRATION submission (declarative tier).
//
// A submitted integration is a DECLARATIVE CONNECTOR: configuration that tells the
// platform how to talk to an external API — auth, resources (endpoints + field
// mappings), and webhooks. The platform's own HTTP client executes it inside the
// tenant's context; the submitter ships NO executable code. This is the safe,
// open-submission tier and covers most "connect my SaaS" needs (docs/63).
//
// Integrations that need real custom logic (e.g. a new PAYMENT or SHIPPING provider
// implementing the typed framework interfaces) are a SEPARATE, sandboxed code tier
// — not part of this declarative contract. See the design doc.
//
// `slug`/`name`/`pricing`/`media` live in sparx.json; this file is the connector.

const integration = {
  // What the connector does. `data` = read/write external records as ext.* sources.
  kind: 'data' as const, // data | (payments | shipping | tax — sandboxed code tier)
  transport: 'rest' as const, // rest | graphql

  baseUrl: 'https://api.acme.example/v1',

  // How the tenant authenticates. The platform stores secrets in its secret manager
  // and injects them per request — the connector only NAMES them.
  auth: {
    type: 'apiKey' as const, // apiKey | bearer | basic | oauth2
    in: 'header' as const,
    name: 'X-Acme-Key',
    secret: 'apiKey', // → a field in `configSchema`, stored encrypted
  },

  // Tenant-supplied configuration, rendered as a form on connect. Secret fields are
  // write-only and stored in the secret manager, never in the catalog row.
  configSchema: [
    { key: 'apiKey', label: 'API key', kind: 'secret', required: true },
    { key: 'accountId', label: 'Account ID', kind: 'text', required: true },
  ],

  // Read/write resources, each exposed to the builder as an `ext.<id>` data source.
  resources: [
    {
      id: 'contacts',
      label: 'Contacts',
      list: { method: 'GET', path: '/accounts/{accountId}/contacts', resultPath: 'data' },
      // Map the external shape onto stable field names the builder binds to.
      fields: {
        id: 'id',
        name: 'full_name',
        email: 'email',
        createdAt: 'created_at',
      },
    },
    {
      id: 'deals',
      label: 'Deals',
      list: { method: 'GET', path: '/accounts/{accountId}/deals', resultPath: 'data' },
      fields: {
        id: 'id',
        title: 'name',
        amount: 'amount_cents',
        stage: 'stage',
      },
    },
  ],

  // Inbound webhooks the platform verifies (by shared secret) and republishes as
  // events on the tenant's bus.
  webhooks: [
    {
      id: 'contact-updated',
      event: 'acme.contact.updated',
      verify: { type: 'hmac' as const, header: 'X-Acme-Signature', secret: 'webhookSecret' },
    },
  ],
};

export default integration;
