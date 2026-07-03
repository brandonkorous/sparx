// Domain MCP tools (docs/64 Module 1 Ph5).
//
// Four tools exposed to the AI layer:
//   get_domains              — read:domains (list all tenant domains + status)
//   check_domain_availability — read:domains (GoDaddy availability + pricing)
//   suggest_domains          — read:domains (name-based suggestions)
//   purchase_domain          — write:domains, confirmation:true (full purchase flow)
//
// `purchase_domain` uses the same flow as the REST endpoint: stub Stripe,
// GoDaddy purchase → DNS config, DB record, domain.purchased Pub/Sub event.
// Stripe will be wired when billing lands; the mock payment_intent_id is a
// placeholder that matches the REST path.

import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { buildSparxDnsRecords, generateDkimKeypair, RegistrarError } from '@sparx/registrar';
import { getRegistrar } from './registrar.js';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { env } from './env.js';

// Module-level publisher — createPublisher caches via internal singleton so
// subsequent calls are no-ops. Mirrors the pattern in api-rest/domains.ts.
const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

// Active registrar (GoDaddy today; swappable via env.REGISTRAR). Cached singleton.
const registrar = getRegistrar();

interface Ctx {
  tenantId: string;
  userId: string;
}

// ─── get_domains ─────────────────────────────────────────────────────────────

const getDomainsTool = {
  name: 'get_domains',
  description:
    'List all web domains registered or connected to this tenant, with their current status (active, pending DNS, verifying, etc.) and expiry dates for purchased domains.',
  scope: 'read:domains' as const,
  input: z.object({}),
  confirmation: false,
  async run(ctx: Ctx) {
    // `domains` is a non-RLS dispatch table — safe to read with the base client,
    // scoped by tenantId in the app. Its `property` relation, HOWEVER, points at
    // `properties`, which is FORCE-RLS: a nested Prisma join runs with no tenant
    // GUC set, so RLS returns zero rows, the required relation resolves to null,
    // and Prisma throws "Field property is required to return data, got null".
    // Resolve the site names in a separate, tenant-scoped query instead — which is
    // also null-safe if a domain's property row was ever removed.
    const domains = await prisma.domain.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        id: true,
        host: true,
        type: true,
        status: true,
        isCanonical: true,
        registrar: true,
        expiresAt: true,
        autoRenew: true,
        whoisPrivacy: true,
        renewalPriceCents: true,
        createdAt: true,
        propertyId: true,
      },
      orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
    });

    const propertyIds = [...new Set(domains.map((d) => d.propertyId))];
    const properties = propertyIds.length
      ? await withTenant(ctx, (tx) =>
          tx.property.findMany({
            where: { id: { in: propertyIds } },
            select: { id: true, name: true, slug: true, isPrimary: true },
          })
        )
      : [];
    const propertyById = new Map(properties.map((p) => [p.id, p]));

    return {
      domains: domains.map(({ propertyId, ...domain }) => ({
        ...domain,
        property: propertyById.get(propertyId) ?? null,
      })),
    };
  },
};

// ─── check_domain_availability ────────────────────────────────────────────────

const checkDomainAvailabilityTool = {
  name: 'check_domain_availability',
  description:
    'Check whether a specific domain name is available for registration, and return its current price.',
  scope: 'read:domains' as const,
  input: z.object({
    domain: z.string().min(3).describe('Fully qualified domain name, e.g. "acme.com"'),
  }),
  confirmation: false,
  async run(_ctx: Ctx, input: { domain: string }) {
    try {
      const result = await registrar.checkAvailability(input.domain);
      return {
        domain: input.domain,
        available: result.available,
        pricePerYearCents: result.price,
        currency: result.currency,
      };
    } catch (err) {
      if (err instanceof RegistrarError) {
        return { error: err.message, domain: input.domain };
      }
      throw err;
    }
  },
};

// ─── suggest_domains ─────────────────────────────────────────────────────────

const suggestDomainsTool = {
  name: 'suggest_domains',
  description:
    'Given a business name or keyword, suggest available domain names with pricing. Searches common TLDs (.com, .net, .org, .co, .io, .shop, etc.).',
  scope: 'read:domains' as const,
  input: z.object({
    query: z.string().min(2).describe('Business name or keyword, e.g. "acme motors"'),
  }),
  confirmation: false,
  async run(_ctx: Ctx, input: { query: string }) {
    try {
      const suggestions = await registrar.getDomainSuggestions(input.query);
      return { suggestions };
    } catch (err) {
      if (err instanceof RegistrarError) {
        return { error: err.message, suggestions: [] };
      }
      throw err;
    }
  },
};

// ─── purchase_domain ─────────────────────────────────────────────────────────

const PurchaseInput = z.object({
  domain: z.string().min(3).describe('Fully qualified domain to purchase, e.g. "acme.com"'),
  years: z.number().int().min(1).max(10).default(1).describe('Registration period in years'),
  privacy: z
    .boolean()
    .default(true)
    .describe('Enable WHOIS privacy to hide registrant details from public WHOIS lookup'),
  // ICANN requires a registrant contact for all domain registrations.
  contact: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    /** E.164 format e.g. +1.4805551234 */
    phone: z.string().min(5),
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1).describe('2-letter state/region code'),
    postalCode: z.string().min(1),
    country: z.string().length(2).describe('ISO 3166-1 alpha-2 country code, e.g. US'),
  }),
});

type PurchaseInput = z.infer<typeof PurchaseInput>;

const purchaseDomainTool = {
  name: 'purchase_domain',
  description:
    'Register a new domain through the sparx GoDaddy reseller account and connect it to this tenant. ' +
    'Configures DNS automatically (CNAME, SPF, DKIM, DMARC). ' +
    'Requires the registrant contact information for ICANN compliance. ' +
    'Payment is billed to the tenant account (Stripe charge stubbed during beta — no charge now). ' +
    'IMPORTANT: This action registers a real domain and cannot be undone. Always confirm the domain name and registration period with the user before proceeding.',
  scope: 'write:domains' as const,
  input: PurchaseInput,
  confirmation: true,
  async run(ctx: Ctx, input: PurchaseInput) {
    // Resolve the tenant's primary property to attach the domain to. `properties`
    // is FORCE-RLS, so this MUST run through withTenant — a bare prisma query has
    // no tenant GUC set and RLS would return null → a false "no primary property".
    const primaryProperty = await withTenant(ctx, (tx) =>
      tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } })
    );
    if (!primaryProperty) {
      throw new Error('No primary property found for this tenant.');
    }

    // 1. Stub Stripe charge — placeholder until billing is wired.
    const mockPaymentIntentId = `pi_mock_${Date.now()}_mcp`;

    // 2. GoDaddy purchase.
    let orderId: string;
    try {
      const result = await registrar.purchaseDomain(
        input.domain,
        input.years,
        input.contact,
        input.privacy
      );
      orderId = result.orderId;
    } catch (err) {
      if (err instanceof RegistrarError) {
        throw new Error(`Domain purchase failed: ${err.message}`);
      }
      throw err;
    }

    // 3. Generate DKIM keypair and configure DNS (non-fatal on failure —
    //    domain-worker retries DNS config via the dnsConfigured flag).
    let dkimPublicKey = '';
    let dkimPrivateKey = '';
    let dnsConfigured = false;
    try {
      const keypair = generateDkimKeypair();
      dkimPublicKey = keypair.publicKey;
      dkimPrivateKey = keypair.privateKey;
      const dnsRecords = buildSparxDnsRecords(dkimPublicKey);
      await registrar.configureDNS(input.domain, dnsRecords);
      dnsConfigured = true;
    } catch {
      // Logged by domain-worker after it retries via the event.
    }

    // 4. Persist purchase ledger row (tenant-scoped, FORCE RLS) + domain row
    //    (non-RLS dispatch table, updated directly).
    const [purchase] = await Promise.all([
      withTenant(ctx, (tx) =>
        tx.domainPurchase.create({
          data: {
            tenantId: ctx.tenantId,
            domain: input.domain,
            registrar: 'godaddy',
            registrarOrderId: orderId,
            stripePaymentIntentId: mockPaymentIntentId,
            amountCents: 0, // stub — price resolved at billing wiring
            years: input.years,
            type: 'registration',
            status: 'pending',
          },
        })
      ),
      prisma.domain.upsert({
        where: { host: input.domain },
        create: {
          tenantId: ctx.tenantId,
          propertyId: primaryProperty.id,
          host: input.domain,
          type: 'purchased',
          status: 'pending_ssl',
          registrar: 'godaddy',
          registrarOrderId: orderId,
          registeredAt: new Date(),
          autoRenew: true,
          whoisPrivacy: input.privacy,
          ...(dkimPublicKey ? { dkimPublicKey, dkimPrivateKey } : {}),
        },
        update: {
          status: 'pending_ssl',
          registrar: 'godaddy',
          registrarOrderId: orderId,
          registeredAt: new Date(),
          ...(dkimPublicKey ? { dkimPublicKey, dkimPrivateKey } : {}),
        },
      }),
    ]);

    // 5. Publish domain.purchased so domain-worker polls propagation.
    await publishEvent(
      publisher,
      'domain.purchased',
      ctx.tenantId,
      ctx.userId,
      {
        domain: input.domain,
        orderId,
        purchaseId: purchase.id,
        propertyId: primaryProperty.id,
        dnsConfigured,
      },
      pubLogger
    );

    return {
      domain: input.domain,
      orderId,
      purchaseId: purchase.id,
      dnsConfigured,
      message: dnsConfigured
        ? `${input.domain} registered and DNS configured. It will go live within a few minutes as DNS propagates.`
        : `${input.domain} registered. DNS configuration will be retried automatically by the domain worker.`,
    };
  },
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const domainMcpTools = [
  getDomainsTool,
  checkDomainAvailabilityTool,
  suggestDomainsTool,
  purchaseDomainTool,
];
