// Handles a single domain.purchased Pub/Sub message:
//   1. If dnsConfigured=false AND status=pending_ssl: retry GoDaddy configureDNS.
//   2. Poll CNAME propagation — throw (→ 500 → Pub/Sub retry) if not yet live.
//   3. On success: mark domain status='active'.
//
// Pub/Sub retry semantics: returning 500 causes redelivery with exponential
// backoff (up to 7 days). The status transition pending_ssl → verifying marks
// that DNS config was applied so subsequent retries skip the GoDaddy call.

import { promises as dns } from 'node:dns';
import type { Logger } from 'pino';
import { prisma } from '@wizeworks/db';
import { publishEvent } from '@wizeworks/events';
import type { DomainPurchasedPayload, SparxEvent } from '@wizeworks/events';
import { appLink, appOrigin } from '@wizeworks/links/server';
import { cnameTargetFor, configureDNS, buildSparxDnsRecords, GoDaddyError } from './godaddy.js';
import { publisher, pubLogger } from './publisher.js';
import { env } from './env.js';

async function verifyCname(host: string, target: string): Promise<boolean> {
  try {
    const cnames = await dns.resolveCname(host);
    const normalized = target.replace(/\.$/, '');
    return cnames.some((c) => c.replace(/\.$/, '') === normalized);
  } catch {
    return false;
  }
}

export function parseDomainPurchasedEvent(raw: unknown): SparxEvent<DomainPurchasedPayload> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const ev = raw as Record<string, unknown>;
  if (ev.type !== 'domain.purchased') return null;
  if (typeof ev.tenantId !== 'string') return null;
  const data = ev.data;
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.domain !== 'string') return null;
  if (typeof d.dnsConfigured !== 'boolean') return null;
  return raw as SparxEvent<DomainPurchasedPayload>;
}

export async function handleDomainPurchased(
  event: SparxEvent<DomainPurchasedPayload>,
  logger: Logger
): Promise<void> {
  const { domain, dnsConfigured } = event.data;

  const row = await prisma.domain.findUnique({ where: { host: domain } });
  if (!row) {
    logger.info({ domain }, 'domain row not found; nothing to do (may have been deleted)');
    return;
  }
  if (row.status === 'active') {
    logger.info({ domain }, 'domain already active; acking idempotently');
    return;
  }

  // Which brand's ingress this customer is being pointed at. A worker has no
  // request and therefore no hostname, so the tenant row is the only place the
  // answer can come from — and it has to be read BEFORE the DNS is written,
  // because a CNAME to the wrong company's host is what the customer copies
  // into their registrar.
  const brand = (
    await prisma.tenant.findUnique({
      where: { id: event.tenantId },
      select: { platformBrand: true },
    })
  )?.platformBrand;

  // Step 1: retry DNS configuration if the purchase flow's configureDNS failed.
  // Only attempt when status is still pending_ssl (not yet tried by this worker).
  if (!dnsConfigured && row.status === 'pending_ssl') {
    logger.info({ domain }, 'retrying GoDaddy DNS configuration');
    try {
      await configureDNS(domain, buildSparxDnsRecords(brand));
      await prisma.domain.update({ where: { host: domain }, data: { status: 'verifying' } });
      logger.info({ domain }, 'DNS configuration retry succeeded');
    } catch (err) {
      if (err instanceof GoDaddyError) {
        logger.warn(
          { domain, httpStatus: err.status },
          'GoDaddy DNS config retry failed; triggering Pub/Sub retry'
        );
      } else {
        logger.error({ domain, err }, 'unexpected error during DNS config retry');
      }
      throw err;
    }
  }

  // Step 2: poll CNAME propagation. If not yet live, throw → 500 → Pub/Sub retry.
  const cnameOk = await verifyCname(domain, cnameTargetFor(brand));
  if (!cnameOk) {
    // Advance status from pending_ssl → verifying if this is the first check,
    // so future retries skip the DNS config step.
    if (row.status === 'pending_ssl') {
      await prisma.domain.update({ where: { host: domain }, data: { status: 'verifying' } });
    }
    logger.info({ domain }, 'CNAME not yet propagated; triggering Pub/Sub retry');
    throw new Error(`CNAME not yet propagated for ${domain}`);
  }

  // Step 3: mark domain active.
  await prisma.domain.update({
    where: { host: domain },
    data: { status: 'active', verifiedAt: new Date() },
  });
  logger.info({ domain }, 'domain is now active');

  // Tell the owner their domain is live. Best-effort — a notification failure must
  // never fail the activation (which would trigger a Pub/Sub retry of a done job).
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: event.tenantId },
      select: { email: true },
    });
    if (tenant?.email) {
      // `brand` is the one read above — without it this link opens the other
      // brand's console.
      await publishEvent(
        publisher,
        'email.send',
        event.tenantId,
        null,
        {
          to: tenant.email,
          template: 'domain-live',
          props: {
            domainName: domain,
            siteUrl: `https://${domain}`,
            dashboardUrl:
              appLink('platform.settings.domains', undefined, { brand }) ?? appOrigin(brand),
          },
        },
        pubLogger
      );
    }
  } catch (err) {
    logger.warn({ err, domain }, 'failed to publish domain-live email; domain is still active');
  }
}
