// Nightly renewal reminder cron. Called by a Cloud Scheduler job POST to
// /internal/cron/renewal-check.
//
// Sends email.send Pub/Sub events at 30d, 14d, and 7d before a purchased
// domain expires. renewalRemindersSent tracks which thresholds have fired
// so each reminder is sent at most once per domain lifecycle.

import type { Logger } from 'pino';
import { prisma } from '@sparx/db';
import { publishEvent } from '@sparx/events';
import { appLink, appOrigin } from '@sparx/links/server';
import { publisher, pubLogger } from './publisher.js';

const THRESHOLDS = [30, 14, 7] as const;

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function runRenewalCheck(logger: Logger): Promise<{ processed: number }> {
  const now = new Date();
  let processed = 0;

  for (const threshold of THRESHOLDS) {
    // Window: domains that expire between (now + threshold - 1 day) and (now + threshold).
    // This catches exactly the right cohort each day without overlap.
    const windowStart = addDays(now, threshold - 1);
    const windowEnd = addDays(now, threshold);

    const expiring = await prisma.domain.findMany({
      where: {
        type: 'purchased',
        status: 'active',
        expiresAt: { gte: windowStart, lt: windowEnd },
        NOT: { renewalRemindersSent: { has: `${threshold}d` } },
      },
      select: {
        id: true,
        host: true,
        tenantId: true,
        expiresAt: true,
        autoRenew: true,
      },
    });

    for (const domain of expiring) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: domain.tenantId },
        select: { email: true },
      });
      if (!tenant?.email) {
        logger.warn(
          { domainId: domain.id, host: domain.host },
          'tenant email not found; skipping renewal reminder'
        );
        continue;
      }

      try {
        await publishEvent(
          publisher,
          'email.send',
          domain.tenantId,
          null,
          {
            to: tenant.email,
            template: 'domain-renewal-reminder',
            props: {
              domainName: domain.host,
              daysUntilExpiry: threshold,
              expiresAt: domain.expiresAt ? formatDate(domain.expiresAt) : 'soon',
              renewUrl: appLink('platform.settings.domains') ?? appOrigin(),
              autoRenew: domain.autoRenew,
            },
          },
          pubLogger
        );

        await prisma.domain.update({
          where: { id: domain.id },
          data: { renewalRemindersSent: { push: `${threshold}d` } },
        });

        logger.info({ host: domain.host, threshold }, 'renewal reminder published');
        processed++;
      } catch (err) {
        logger.error({ err, host: domain.host, threshold }, 'failed to publish renewal reminder');
      }
    }
  }

  return { processed };
}
