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
import { prisma } from '@sparx/db';
import type { DomainPurchasedPayload, SparxEvent } from '@sparx/events';
import { configureDNS, buildSparxDnsRecords, GoDaddyError } from './godaddy.js';
import { env } from './env.js';

const CNAME_TARGET = env.SPARX_CNAME_TARGET;

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

  // Step 1: retry DNS configuration if the purchase flow's configureDNS failed.
  // Only attempt when status is still pending_ssl (not yet tried by this worker).
  if (!dnsConfigured && row.status === 'pending_ssl') {
    if (!row.dkimPublicKey) {
      logger.warn(
        { domain },
        'no DKIM public key on domain row; advancing to verifying without DNS retry'
      );
      await prisma.domain.update({ where: { host: domain }, data: { status: 'verifying' } });
    } else {
      logger.info({ domain }, 'retrying GoDaddy DNS configuration');
      try {
        await configureDNS(domain, buildSparxDnsRecords(row.dkimPublicKey));
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
  }

  // Step 2: poll CNAME propagation. If not yet live, throw → 500 → Pub/Sub retry.
  const cnameOk = await verifyCname(domain, CNAME_TARGET);
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
}
