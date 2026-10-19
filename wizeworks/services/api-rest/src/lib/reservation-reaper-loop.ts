// Releasing cart holds that have run out, where nothing else does (sparx persona
// issue 335).
//
// A cart holds what is in it for 30 minutes, so two shoppers cannot buy the last
// one. In the cluster a CronJob (k8s/cronjobs/commerce-reservation-reaper.yaml)
// calls /internal/commerce/reservation-reaper every minute to let go of the holds
// whose time is up. Off the cluster nothing called it, so a hold never ended: a
// basket left in a closed tab kept Gillett's last DDP injector, and its page said
// "Sold out" to everybody, for as long as the API ran (issues 316 and 318 met
// the same thing and released them by hand).
//
// So, off the cluster, this API does what the CronJob does, on the same minute,
// and one copy at a time across processes. In production the CronJob stays the
// one runner, as the deployment describes.

import type { FastifyBaseLogger } from 'fastify';

import { ADVISORY_LOCKS, withAdvisoryTickLock } from '@wizeworks/db';
import { commerceSchedulers } from '@wizeworks/commerce';

const INTERVAL_MS = 60_000;

export interface ReaperTick {
  acquired: boolean;
  released: number;
}

/** One pass over every business that sells: release the holds whose time is up. */
export async function runReservationReaperTick(logger: FastifyBaseLogger): Promise<ReaperTick> {
  return withAdvisoryTickLock(
    ADVISORY_LOCKS.RESERVATION_REAPER,
    { acquired: false, released: 0 },
    async () => {
      let released = 0;
      for (const tenant of await commerceSchedulers.listCommerceActiveTenants()) {
        try {
          released += (await commerceSchedulers.reapExpiredReservations({ tenantId: tenant.id }))
            .released;
        } catch (err) {
          logger.warn({ err, tenantId: tenant.id }, 'reservation-reaper: tenant failed');
        }
      }
      if (released > 0) logger.info({ released }, 'reservation-reaper: released expired holds');
      return { acquired: true, released };
    }
  );
}

/** Run the reaper every minute, off the cluster only. Returns the stop handle. */
export function startReservationReaperLoop(
  logger: FastifyBaseLogger,
  production: boolean
): () => void {
  if (production) return () => undefined;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await runReservationReaperTick(logger);
    } catch (err) {
      logger.error({ err }, 'reservation-reaper: tick threw, will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), INTERVAL_MS);
  };
  timer = setTimeout(() => void tick(), INTERVAL_MS);
  logger.info(
    { intervalMs: INTERVAL_MS },
    'reservation-reaper: loop started (no cluster CronJob here)'
  );
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
