// seed-demo — stand up the varied multi-tenant demo (docs/104, Wave 6).
//
//   pnpm --filter @sparx/api-rest seed:demo            # provision every demo tenant
//   pnpm --filter @sparx/api-rest seed:demo --only demo-salon
//   pnpm --filter @sparx/api-rest seed:demo --drop demo-salon   # tear one down (cascades)
//
// Registers the SAME in-process bus consumers the live server wires at boot, so
// firing `module.activated` inside seedTenant seeds every L2 baseline (CRM
// pipeline/segments, default emails, fallback shipping/tax, warehouse, scheduling
// defaults) exactly as a real module toggle would. Then each spec runs the real
// provisioning path (starter → blueprint → sample data). Additive + idempotent:
// it only ever touches `demo-*` tenants, never e2e-store, so it's safe to run
// against a shared dev DB.

import 'dotenv/config';

import { registerCommerceConsumers } from '@sparx/commerce/consumers';
import { registerCrmConsumers } from '@sparx/crm';
import { prisma } from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';

import { registerEmailProvisioningConsumer } from '../lib/email-provisioning.js';
import { registerModuleProvisioningConsumer } from '../lib/module-provisioning.js';
import { DEMO_TENANTS, getDemoTenant } from '../lib/demo-tenants.js';
import { seedTenant, type SeedTenantResult } from '../lib/seed-tenant.js';

// Minimal pino-shaped logger — the blueprint installer takes a FastifyBaseLogger
// but only logs; a console-backed stub satisfies it without dragging in Fastify.
function makeLogger(): FastifyBaseLogger {
  const log =
    (level: string) =>
    (...args: unknown[]): void => {
      const [first, ...rest] = args;
      if (typeof first === 'object') console.log(`[${level}]`, rest.join(' '), first);
      else console.log(`[${level}]`, ...args);
    };
  const noop = (): void => undefined;
  const logger: Record<string, unknown> = {
    level: 'info',
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    debug: noop,
    trace: noop,
    fatal: log('fatal'),
    silent: noop,
  };
  logger.child = () => logger;
  return logger as unknown as FastifyBaseLogger;
}

function summarize(r: SeedTenantResult): string {
  const s = r.sample;
  const sampleStr = s
    ? `prod=${s.products} ord=${s.orders} rev=${s.reviews} deal=${s.deals} book=${s.bookings} art=${s.articles}`
    : 'none';
  return [
    `${r.created ? 'CREATED' : 'updated'} ${r.slug} (${r.tenantId.slice(0, 8)})`,
    `modules=[${r.enabledModules.join(',')}]`,
    `starter: +${r.starter.installed.length} =${r.starter.alreadyInstalled.length} skip${r.starter.skipped.length}`,
    `blueprint: ${r.blueprint.status}${r.blueprint.status === 'skipped' ? ` (${r.blueprint.reason})` : ''}`,
    `sample: ${sampleStr}`,
  ].join('\n    ');
}

async function dropTenant(slug: string): Promise<void> {
  // tenants has no RLS; delete cascades every tenant-scoped row.
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) {
    console.log(`[drop] no tenant with slug "${slug}"`);
    return;
  }
  await prisma.tenant.delete({ where: { id: tenant.id } });
  console.log(`[drop] deleted ${slug} (${tenant.id}) and all its rows`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dropIdx = argv.indexOf('--drop');
  if (dropIdx !== -1) {
    const slug = argv[dropIdx + 1];
    if (!slug) throw new Error('--drop requires a tenant slug');
    await dropTenant(slug);
    return;
  }

  // Wire the in-process consumers BEFORE provisioning so module.activated is heard.
  registerCrmConsumers();
  registerCommerceConsumers();
  registerEmailProvisioningConsumer();
  registerModuleProvisioningConsumer();

  const onlyIdx = argv.indexOf('--only');
  let specs = DEMO_TENANTS;
  if (onlyIdx !== -1) {
    const slug = argv[onlyIdx + 1];
    const one = slug ? getDemoTenant(slug) : undefined;
    if (!one) throw new Error(`--only: unknown demo tenant "${slug ?? ''}"`);
    specs = [one];
  }

  const logger = makeLogger();
  console.log(`Seeding ${specs.length} demo tenant(s)…\n`);
  const failures: string[] = [];
  for (const spec of specs) {
    try {
      const result = await seedTenant(spec, logger);
      console.log(`  ✓ ${summarize(result)}\n`);
    } catch (err) {
      const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
      failures.push(`${spec.slug}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`  ✗ ${spec.slug} FAILED: ${msg}\n`);
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} demo tenant(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${specs.length} demo tenant(s) provisioned.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
