// Domains — the hostnames pointing at a tenant's web PROPERTIES (docs/49 §5,
// docs/24). The "Foundation + BYO connect" surface: every property is born with
// an always-on `*.sparx.zone` subdomain (minted by the property-create flow),
// and a tenant can CONNECT a domain they already own (CNAME + TXT proof).
//
//   GET    /v1/domains            ?propertyId=  → the tenant's domains (optionally one property's)
//   POST   /v1/domains                          → connect a custom domain { propertyId, host }
//   GET    /v1/domains/:id                       → one domain (+ DNS instructions while pending)
//   POST   /v1/domains/:id/verify                → poll DNS now; verified → routable
//   PATCH  /v1/domains/:id                        → set canonical (the property's apex host)
//   DELETE /v1/domains/:id                        → disconnect (subdomain hosts are protected)
//
// Domain PURCHASE surface (docs/24, docs/64 Module 1 Ph2):
//   POST   /v1/domains/search                    → { query } → DomainSuggestion[]
//   POST   /v1/domains/check                     → { domain } → DomainAvailability
//   POST   /v1/domains/purchase                  → full purchase + DNS config flow
//   POST   /v1/domains/:id/renew                 → { years } → renew through GoDaddy
//   POST   /v1/domains/:id/transfer-out          → initiate transfer; returns authCode
//   PATCH  /v1/domains/:id/privacy               → { enabled } toggle WHOIS privacy
//   PATCH  /v1/domains/:id/auto-renew            → { enabled } toggle GoDaddy auto-renew
//
// `domains` is a NON-RLS dispatch table (host→property resolution runs before a
// tenant is known). So every query here filters by tenant_id IN THE APP — the
// security boundary is the explicit `where: { tenantId }`, exactly as the
// `tenants` table is managed. Property ownership is checked through withTenant
// (properties IS FORCE RLS). Owned ABOVE modules (not module-gated), like
// /v1/properties.
//
// `domain_purchases` IS FORCE RLS — all reads/writes use withTenant().

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { notFound, conflict, validationError, badRequest, forbidden } from '@sparx/api-core/errors';
import { requireRole } from '@sparx/api-core/auth';
import { requireVerifiedEmail } from '../../lib/verified-email-guard.js';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import type { DomainPurchasedPayload } from '@sparx/events';
import {
  normalizeHost,
  isValidHost,
  isZoneHost,
  isSubdomainHost,
  newVerificationToken,
  connectInstructions,
  verifyTxtToken,
  verifyCname,
  CNAME_TARGET,
} from '../../lib/domain.js';
import {
  buildSparxDnsRecords,
  generateDkimKeypair,
  getRegistrar,
  RegistrarError,
} from '../../lib/registrar.js';
import { chargeForDomain, refundDomainCharge } from '../../lib/domain-billing.js';
import { env } from '../../env.js';

// Pub/Sub publisher — one instance for the lifetime of the process.
const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

// ─── Convenience fee per TLD (cents) ─────────────────────────────────────────
// Added to the GoDaddy wholesale price when quoting to the tenant (docs/24 §6).
const TLD_MARKUP: Record<string, number> = {
  // commerce TLDs — leanest convenience fee
  shop: 150,
  store: 150,
  online: 150,
  site: 150,
  // classics + generic — standard fee (also the fall-through default)
  com: 200,
  net: 200,
  org: 200,
  // tech / premium-leaning — slightly higher fee
  io: 300,
  app: 300,
  dev: 300,
  ai: 300,
  tech: 300,
};
function markupForTld(tld: string): number {
  return TLD_MARKUP[tld.toLowerCase()] ?? 200;
}

/** The EXACT domain a search query implies, so we can report its true status.
 *  `suggest` only returns AVAILABLE look-alikes, so without this a taken exact
 *  match (gillettdiesel.com) is invisible and a near-miss (gillett-diesel.com)
 *  reads as "your domain is available". A query with a dot is treated as a
 *  literal host; otherwise non-alphanumerics are stripped and `.com` appended. */
function deriveExactHost(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (q.includes('.')) {
    const h = normalizeHost(q);
    return isValidHost(h) && !isZoneHost(h) ? h : null;
  }
  const label = q.replace(/[^a-z0-9]+/g, '');
  if (label.length < 1 || label.length > 63) return null;
  return `${label}.com`;
}

// ─── View types ──────────────────────────────────────────────────────────────

interface DomainView {
  id: string;
  propertyId: string;
  host: string;
  type: string;
  status: string;
  isCanonical: boolean;
  verifiedAt: string | null;
  registrar: string | null;
  registrarOrderId: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  whoisPrivacy: boolean;
  renewalPriceCents: number | null;
  createdAt: string;
  // DNS records the tenant must add — present only while a custom domain is
  // unverified (pending/verifying/failed). Null once active or for subdomains.
  instructions: ReturnType<typeof connectInstructions> | null;
}

interface DomainPurchaseView {
  id: string;
  domain: string;
  registrar: string;
  registrarOrderId: string | null;
  stripePaymentIntentId: string | null;
  amountCents: number;
  years: number;
  type: string;
  status: string;
  createdAt: string;
}

function toView(row: {
  id: string;
  propertyId: string;
  host: string;
  type: string;
  status: string;
  isCanonical: boolean;
  verificationToken: string | null;
  verifiedAt: Date | null;
  registrar: string | null;
  registrarOrderId: string | null;
  registeredAt: Date | null;
  expiresAt: Date | null;
  autoRenew: boolean;
  whoisPrivacy: boolean;
  renewalPriceCents: number | null;
  createdAt: Date;
}): DomainView {
  const needsDns = row.type === 'custom' && row.status !== 'active' && row.status !== 'verified';
  return {
    id: row.id,
    propertyId: row.propertyId,
    host: row.host,
    type: row.type,
    status: row.status,
    isCanonical: row.isCanonical,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    registrar: row.registrar,
    registrarOrderId: row.registrarOrderId,
    registeredAt: row.registeredAt ? row.registeredAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    autoRenew: row.autoRenew,
    whoisPrivacy: row.whoisPrivacy,
    renewalPriceCents: row.renewalPriceCents,
    createdAt: row.createdAt.toISOString(),
    instructions:
      needsDns && row.verificationToken
        ? connectInstructions(row.host, row.verificationToken)
        : null,
  };
}

function toPurchaseView(row: {
  id: string;
  domain: string;
  registrar: string;
  registrarOrderId: string | null;
  stripePaymentIntentId: string | null;
  amountCents: number;
  years: number;
  type: string;
  status: string;
  createdAt: Date;
}): DomainPurchaseView {
  return {
    id: row.id,
    domain: row.domain,
    registrar: row.registrar,
    registrarOrderId: row.registrarOrderId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    amountCents: row.amountCents,
    years: row.years,
    type: row.type,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const IdParam = z.object({ id: z.string().uuid() });
const ListQuery = z.object({ propertyId: z.string().uuid().optional() });
const ConnectBody = z.object({
  propertyId: z.string().uuid(),
  host: z.string().min(1).max(255),
});
const PatchBody = z.object({ isCanonical: z.literal(true) });

const SearchBody = z.object({ query: z.string().min(1).max(100) });
const CheckBody = z.object({ domain: z.string().min(1).max(253) });

const RegistrantContactSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().min(5).max(50),
  address1: z.string().min(1).max(255),
  address2: z.string().max(255).optional(),
  city: z.string().min(1).max(120),
  state: z.string().min(1).max(10),
  postalCode: z.string().min(1).max(32),
  country: z.string().length(2),
});

const PurchaseBody = z.object({
  domain: z.string().min(1).max(253),
  years: z.number().int().min(1).max(10).default(1),
  privacy: z.boolean().default(false),
  propertyId: z.string().uuid(),
  contact: RegistrantContactSchema,
});

const RenewBody = z.object({
  years: z.number().int().min(1).max(10).default(1),
});

const PrivacyBody = z.object({ enabled: z.boolean() });
const AutoRenewBody = z.object({ enabled: z.boolean() });

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Confirm the property belongs to the caller's tenant (properties IS RLS).
 *  Returns true when found. */
async function ownProperty(tenantId: string, propertyId: string): Promise<boolean> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.property.findUnique({ where: { id: propertyId }, select: { id: true } })
  );
  return row != null;
}

/** Resolve a purchased domain row by id, scoped to the caller's tenant. */
async function findPurchasedDomain(tenantId: string, id: string) {
  const row = await prisma.domain.findFirst({ where: { id, tenantId } });
  if (!row) throw notFound('Domain', id);
  if (row.type !== 'purchased') {
    throw conflict('This operation is only available for sparx-purchased domains.', {
      field: 'type',
    });
  }
  return row;
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature.
const domainsRoutes: FastifyPluginAsync = async (app) => {
  // The active registrar (GoDaddy today; swappable via env.REGISTRAR). Resolved
  // once — construction is cheap and touches no credentials.
  const registrar = getRegistrar();

  // ── POST /v1/domains/search ───────────────────────────────────────────────
  // Must be registered BEFORE /:id routes so the literal path wins.
  app.post('/v1/domains/search', async (request) => {
    requireRole(request, 'viewer');
    const { query } = SearchBody.parse(request.body);
    const suggestions = await registrar.getDomainSuggestions(query);

    const priced = suggestions.map((s) => ({
      ...s,
      exact: false,
      displayPrice: s.price + markupForTld(s.tld),
      renewalDisplayPrice: s.renewalPrice + markupForTld(s.tld),
    }));

    // Lead with the EXACT domain's true status — suggest() only returns available
    // look-alikes, so a taken exact match would otherwise be invisible.
    const exactHost = deriveExactHost(query);
    if (exactHost) {
      const dup = priced.find((s) => s.domain === exactHost);
      if (dup) {
        dup.exact = true;
      } else {
        try {
          const avail = await registrar.checkAvailability(exactHost);
          const fee = markupForTld(avail.tld);
          priced.unshift({
            domain: exactHost,
            tld: avail.tld,
            available: avail.available,
            price: avail.price,
            renewalPrice: avail.renewalPrice,
            currency: avail.currency,
            exact: true,
            displayPrice: avail.price + fee,
            renewalDisplayPrice: avail.renewalPrice + fee,
          });
        } catch {
          // exact lookup is best-effort; the suggestions still stand
        }
      }
    }

    return ok(priced);
  });

  // ── POST /v1/domains/check ────────────────────────────────────────────────
  app.post('/v1/domains/check', async (request) => {
    requireRole(request, 'viewer');
    const { domain } = CheckBody.parse(request.body);
    const avail = await registrar.checkAvailability(domain);
    return ok({
      ...avail,
      displayPrice: avail.price + markupForTld(avail.tld),
      renewalDisplayPrice: avail.renewalPrice + markupForTld(avail.tld),
    });
  });

  // ── POST /v1/domains/purchase ─────────────────────────────────────────────
  // Full purchase flow (docs/24 §4, docs/64 Module 1 Ph2):
  //   0. Gate: checkout must be OPEN (env.DOMAIN_PURCHASE_ENABLED) — buying a
  //      domain is a real, non-refundable charge to our reseller account.
  //   1. Price + re-check availability (REQUIRED — we never charge blind, and in
  //      the deferred-purchase flow the domain is chosen before it's bought).
  //   2. Charge the tenant for real (chargeForDomain) BEFORE registering.
  //   3. GoDaddy: purchaseDomain → orderId (refund the charge if this fails).
  //   4. GoDaddy: generateDkimKeypair + configureDNS (sparx record set)
  //   5. DB: insert domain_purchases + upsert domains row (type: purchased)
  //   6. Pub/Sub: publish domain.purchased
  //   7. Return { domain, orderId, expiresAt, purchase }
  app.post('/v1/domains/purchase', async (request) => {
    const auth = requireRole(request, 'editor');
    await requireVerifiedEmail(request);

    // 0. Checkout gate. A domain registration bills the sparx reseller account the
    //    instant GoDaddy is called (ICANN: no trial, no reversal), so buying is
    //    OFF until tenant billing (Stripe) lets us charge the buyer FIRST. Free
    //    *.sparx.zone subdomains and connecting an owned domain are unaffected —
    //    only buying a NEW domain is gated here.
    if (!env.DOMAIN_PURCHASE_ENABLED) {
      throw forbidden(
        "Domain checkout isn't open yet. Your site is live on its free address — you can buy a custom domain from Settings once checkout opens."
      );
    }

    const input = PurchaseBody.parse(request.body);

    const host = normalizeHost(input.domain);
    if (!isValidHost(host)) {
      throw validationError('Enter a valid domain (e.g. acmeparts.com).', [
        { field: 'domain', message: 'Not a valid hostname.' },
      ]);
    }
    if (isZoneHost(host)) {
      throw validationError(
        'sparx.zone domains cannot be purchased — they are issued automatically.',
        [{ field: 'domain', message: 'sparx.zone subdomains cannot be purchased.' }]
      );
    }
    if (!(await ownProperty(auth.tenantId, input.propertyId))) {
      throw notFound('Property', input.propertyId);
    }
    const existing = await prisma.domain.findUnique({ where: { host }, select: { id: true } });
    if (existing)
      throw conflict('That domain is already connected to a site.', { field: 'domain' });

    // 1. Price the order — REQUIRED before charging (never charge an unknown
    //    amount). This also RE-CHECKS availability: in the deferred-purchase flow
    //    the domain is chosen at the Domain step but bought at Launch, so it could
    //    have been registered by someone else in between. The (possibly promo)
    //    first-year REGISTRATION price drives the first year; the RENEWAL price
    //    drives the renewal_price_cents column and any additional years — they
    //    differ sharply for TLDs like .shop ($0.99 to register, $59.99 to renew),
    //    so they must not be conflated.
    const avail = await registrar.checkAvailability(host);
    if (!avail.available) {
      throw conflict(
        'That domain is no longer available — it was registered elsewhere. Try another.',
        { field: 'domain' }
      );
    }
    const registrationPriceCents = avail.price;
    const renewalPriceCents = avail.renewalPrice;
    const purchaseTld = host.split('.').slice(1).join('.');
    const amountCents =
      registrationPriceCents +
      (renewalPriceCents ?? registrationPriceCents) * (input.years - 1) +
      markupForTld(purchaseTld);
    if (amountCents <= 0) {
      throw badRequest('Could not determine the price for that domain. Please try again.');
    }

    // 2. Charge the tenant FIRST — fail here and nothing is registered (the tenant
    //    is never billed for a domain we couldn't complete).
    const { paymentIntentId } = await chargeForDomain({
      tenantId: auth.tenantId,
      amountCents,
      description: `Domain registration: ${host} (${input.years}yr)`,
    });

    // 3. GoDaddy: register. If this fails AFTER we charged, refund so the tenant is
    //    never billed for a domain they didn't get.
    let orderId: string;
    try {
      ({ orderId } = await registrar.purchaseDomain(
        host,
        input.years,
        input.contact,
        input.privacy
      ));
    } catch (err) {
      await refundDomainCharge(paymentIntentId).catch(() => undefined);
      throw err;
    }

    // 4. GoDaddy: DKIM keypair + DNS
    const { publicKey: dkimPublicKey, privateKey: dkimPrivateKey } = generateDkimKeypair();
    const dnsRecords = buildSparxDnsRecords(dkimPublicKey);

    let dnsConfigured = false;
    try {
      await registrar.configureDNS(host, dnsRecords);
      dnsConfigured = true;
    } catch (err) {
      // DNS config failure is non-fatal: the domain is registered. The
      // domain-worker will retry when it processes the domain.purchased event.
      pubLogger.warn({ err, host }, 'domains: GoDaddy DNS config failed; domain-worker will retry');
    }

    // 5. DB: insert purchase ledger row + upsert domain row
    const registeredAt = new Date();
    const expiresAt = new Date(registeredAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + input.years);

    const [purchaseRow, domainRow] = await prisma.$transaction(async (tx) => {
      const purchase = await withTenant({ tenantId: auth.tenantId }, (wtx) =>
        wtx.domainPurchase.create({
          data: {
            tenantId: auth.tenantId,
            domain: host,
            registrar: 'godaddy',
            registrarOrderId: orderId,
            stripePaymentIntentId: paymentIntentId,
            // registration (+ renewal for extra years) + our markup, in cents
            amountCents,
            years: input.years,
            type: 'registration',
            status: 'completed',
          },
        })
      );

      const domain = await tx.domain.upsert({
        where: { host },
        create: {
          tenantId: auth.tenantId,
          propertyId: input.propertyId,
          host,
          type: 'purchased',
          status: 'pending_ssl',
          isCanonical: false,
          registrar: 'godaddy',
          registrarOrderId: orderId,
          registeredAt,
          expiresAt,
          autoRenew: true,
          whoisPrivacy: input.privacy,
          renewalPriceCents,
          dkimPublicKey,
          dkimPrivateKey,
        },
        update: {
          type: 'purchased',
          status: 'pending_ssl',
          registrar: 'godaddy',
          registrarOrderId: orderId,
          registeredAt,
          expiresAt,
          autoRenew: true,
          whoisPrivacy: input.privacy,
          renewalPriceCents,
          dkimPublicKey,
          dkimPrivateKey,
        },
      });

      return [purchase, domain];
    });

    // 5. Pub/Sub: domain.purchased
    await publishEvent<DomainPurchasedPayload>(
      publisher,
      'domain.purchased',
      auth.tenantId,
      auth.actorId,
      {
        domain: host,
        orderId,
        purchaseId: purchaseRow.id,
        propertyId: input.propertyId,
        dnsConfigured,
      },
      pubLogger
    );

    return ok({
      domain: toView(domainRow),
      purchase: toPurchaseView(purchaseRow),
      orderId,
      expiresAt: expiresAt.toISOString(),
    });
  });

  // ── GET /v1/domains ───────────────────────────────────────────────────────
  app.get('/v1/domains', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { propertyId } = ListQuery.parse(request.query);
    const rows = await prisma.domain.findMany({
      where: { tenantId: auth.tenantId, ...(propertyId ? { propertyId } : {}) },
      orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
    });
    return ok(rows.map(toView));
  });

  // ── GET /v1/domains/:id ───────────────────────────────────────────────────
  app.get('/v1/domains/:id', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const row = await prisma.domain.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!row) throw notFound('Domain', id);
    return ok(toView(row));
  });

  // Connect a domain the tenant already owns. Mints a TXT proof token and stores
  // a pending row; the tenant adds the DNS records (returned as `instructions`)
  // then calls /verify. The host is GLOBALLY unique — a 409 means another site
  // (this tenant's or anyone's) already holds it.
  app.post('/v1/domains', async (request) => {
    const auth = requireRole(request, 'editor');
    const input = ConnectBody.parse(request.body);
    const host = normalizeHost(input.host);
    if (!isValidHost(host)) {
      throw validationError('Enter a valid domain (e.g. shop.acme.com).', [
        { field: 'host', message: 'Not a valid hostname.' },
      ]);
    }
    if (isZoneHost(host)) {
      throw validationError('That host is managed by sparx and is added automatically.', [
        { field: 'host', message: 'sparx.zone subdomains cannot be connected.' },
      ]);
    }
    if (!(await ownProperty(auth.tenantId, input.propertyId))) {
      throw notFound('Property', input.propertyId);
    }
    const existing = await prisma.domain.findUnique({ where: { host }, select: { id: true } });
    if (existing) throw conflict('That domain is already connected to a site.', { field: 'host' });

    // Subdomains (3+ labels) prove ownership via CNAME — no separate TXT token
    // needed. Apex domains (2 labels) require a TXT control-proof because
    // CNAME-at-apex is non-standard and silently unsupported by many DNS providers.
    const verificationToken = isSubdomainHost(host) ? null : newVerificationToken();

    const row = await prisma.domain.create({
      data: {
        tenantId: auth.tenantId,
        propertyId: input.propertyId,
        host,
        type: 'custom',
        status: 'pending',
        verificationToken,
      },
    });
    return ok(toView(row));
  });

  // Poll DNS for ownership proof. On success the domain becomes routable
  // (status='active') and Caddy will issue its cert on the next HTTPS hit.
  //
  // Subdomains (3+ labels): ownership proof = CNAME points to customers.sparx.zone.
  // Apex domains (2 labels): ownership proof = TXT control-proof token at
  //   _sparx-verify.<host>. We still require the CNAME/ALIAS be in place for
  //   routing, but we verify ownership via TXT because CNAME-at-apex is unreliable
  //   across DNS providers.
  app.post('/v1/domains/:id/verify', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const row = await prisma.domain.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!row) throw notFound('Domain', id);
    if (row.type !== 'custom') {
      // zone-subdomain / purchased hosts are already live; nothing to verify.
      return ok(toView(row));
    }

    let passed: boolean;
    if (isSubdomainHost(row.host)) {
      // Subdomain: CNAME to our ingress is both routing and ownership proof.
      passed = await verifyCname(row.host, CNAME_TARGET);
    } else {
      // Apex domain: TXT control-proof (the CNAME/ALIAS must also be in place
      // for routing, but TXT is what proves unambiguous ownership here).
      if (!row.verificationToken) {
        throw validationError('This domain has no verification token.', [
          { field: 'id', message: 'Missing token.' },
        ]);
      }
      passed = await verifyTxtToken(row.host, row.verificationToken);
    }

    const updated = await prisma.domain.update({
      where: { id },
      data: passed
        ? { status: 'active', verifiedAt: new Date(), verificationToken: null }
        : { status: 'failed' },
    });
    if (!passed) {
      const hint = isSubdomainHost(row.host)
        ? `We couldn't find a CNAME for ${row.host} pointing to ${CNAME_TARGET} yet. DNS propagation can take a few minutes — add the CNAME record and try again.`
        : `We couldn't find the TXT record at _sparx-verify.${row.host} yet. DNS propagation can take a few minutes — add both the CNAME/ALIAS and the TXT record, then try again.`;
      throw validationError(hint, [{ field: 'host', message: 'Verification failed.' }]);
    }
    return ok(toView(updated));
  });

  // Make this host the canonical (apex) one for its property — at most one
  // canonical per property (the others 301 to it at the edge). One tx so two
  // hosts are never both canonical.
  app.patch('/v1/domains/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    PatchBody.parse(request.body);
    const row = await prisma.domain.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!row) throw notFound('Domain', id);
    if (row.status !== 'active' && row.status !== 'verified') {
      throw conflict('Verify this domain before making it canonical.', { field: 'status' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.domain.updateMany({
        where: { propertyId: row.propertyId, isCanonical: true },
        data: { isCanonical: false },
      });
      return tx.domain.update({ where: { id }, data: { isCanonical: true } });
    });
    return ok(toView(updated));
  });

  // Disconnect a custom/purchased domain. The always-on subdomain is the site's
  // permanent address and can't be removed (delete the property instead).
  app.delete('/v1/domains/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const row = await prisma.domain.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!row) throw notFound('Domain', id);
    if (row.type === 'subdomain') {
      throw conflict(
        'The sparx.zone subdomain is the site’s permanent address and cannot be removed.',
        { field: 'type' }
      );
    }
    await prisma.domain.delete({ where: { id } });
    return ok({ id });
  });

  // ── POST /v1/domains/:id/renew ────────────────────────────────────────────
  app.post('/v1/domains/:id/renew', async (request) => {
    const auth = requireRole(request, 'editor');

    // Renewing bills the reseller account just like a new registration, so it's
    // gated behind the same checkout switch — renewals open when checkout does.
    if (!env.DOMAIN_PURCHASE_ENABLED) {
      throw forbidden("Domain checkout isn't open yet — renewals open when checkout does.");
    }

    const { id } = IdParam.parse(request.params);
    const { years } = RenewBody.parse(request.body);

    const row = await findPurchasedDomain(auth.tenantId, id);

    // Price the renewal — REQUIRED before charging. `years` of the renewal price
    // plus our per-TLD fee.
    const renewalTld = row.host.split('.').slice(1).join('.');
    const amountCents =
      row.renewalPriceCents != null ? row.renewalPriceCents * years + markupForTld(renewalTld) : 0;
    if (amountCents <= 0) {
      throw badRequest('Could not determine the renewal price for that domain.');
    }

    // Charge the tenant FIRST; refund if GoDaddy then fails.
    const { paymentIntentId } = await chargeForDomain({
      tenantId: auth.tenantId,
      amountCents,
      description: `Domain renewal: ${row.host} (${years}yr)`,
    });

    let orderId: string | null;
    try {
      ({ orderId } = await registrar.renewDomain(row.host, years));
    } catch (err) {
      await refundDomainCharge(paymentIntentId).catch(() => undefined);
      throw err;
    }

    const newExpiresAt = new Date(row.expiresAt ?? new Date());
    newExpiresAt.setFullYear(newExpiresAt.getFullYear() + years);

    const [purchaseRow, updatedDomain] = await prisma.$transaction(async (tx) => {
      const purchase = await withTenant({ tenantId: auth.tenantId }, (wtx) =>
        wtx.domainPurchase.create({
          data: {
            tenantId: auth.tenantId,
            domain: row.host,
            registrar: 'godaddy',
            registrarOrderId: orderId ?? null,
            stripePaymentIntentId: paymentIntentId,
            amountCents,
            years,
            type: 'renewal',
            status: 'completed',
          },
        })
      );
      const domain = await tx.domain.update({
        where: { id },
        data: { expiresAt: newExpiresAt },
      });
      return [purchase, domain];
    });

    return ok({
      domain: toView(updatedDomain),
      purchase: toPurchaseView(purchaseRow),
      expiresAt: newExpiresAt.toISOString(),
    });
  });

  // ── POST /v1/domains/:id/transfer-out ────────────────────────────────────
  app.post('/v1/domains/:id/transfer-out', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);

    const row = await findPurchasedDomain(auth.tenantId, id);

    let authCode: string;
    try {
      ({ authCode } = await registrar.initiateTransferOut(row.host));
    } catch (err) {
      if (err instanceof RegistrarError) {
        throw validationError(`Registrar transfer-out failed: ${err.message}`, [
          { field: 'domain', message: err.message },
        ]);
      }
      throw badRequest('Transfer-out failed unexpectedly.');
    }

    // Mark the domain as pending transfer
    await prisma.domain.update({
      where: { id },
      data: { status: 'transfer_pending' },
    });

    return ok({ authCode });
  });

  // ── PATCH /v1/domains/:id/privacy ────────────────────────────────────────
  app.patch('/v1/domains/:id/privacy', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const { enabled } = PrivacyBody.parse(request.body);

    const row = await findPurchasedDomain(auth.tenantId, id);

    await registrar.setPrivacy(row.host, enabled);

    const updated = await prisma.domain.update({
      where: { id },
      data: { whoisPrivacy: enabled },
    });

    return ok(toView(updated));
  });

  // ── PATCH /v1/domains/:id/auto-renew ─────────────────────────────────────
  app.patch('/v1/domains/:id/auto-renew', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const { enabled } = AutoRenewBody.parse(request.body);

    const row = await findPurchasedDomain(auth.tenantId, id);

    await registrar.setAutoRenew(row.host, enabled);

    const updated = await prisma.domain.update({
      where: { id },
      data: { autoRenew: enabled },
    });

    return ok(toView(updated));
  });
};

export default domainsRoutes;
