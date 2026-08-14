import 'server-only';
import type { Prisma } from '@sparx/db';
import { requiredModules, type ModuleSlug } from '@sparx/auth';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';

// Turning on the apps a business said it needs.
//
// ── WHY A FLAG WRITE IS NOT AN ACTIVATION ───────────────────────────────────
//
// `settings.modules.<slug>.enabled` is what every gate READS, so it is tempting
// to treat writing it as the whole job. It is not. Activation is an EVENT, and
// `module.activated` is what makes the app actually work when the person opens
// it:
//
//   • the CRM seeds its pipeline, segments, SLA policies and object registry
//   • the automation catalogue seeds its system automations
//   • commerce writes default tax and shipping settings
//   • finance provisions its accounts
//   • the builder installs the default transactional emails
//
// Write the flag alone and you get a business whose Customers app is switched on
// and has no pipeline in it — which reads to the owner as a broken product, not
// as a missing seed. This module exists so that never happens: the flags and the
// events are two halves of one operation, and neither is done without the other.
//
// ── WHY IT IS NOT `PUT /v1/tenant/modules` ──────────────────────────────────
//
// api-rest's route is the canonical path and the console uses it for "Add app".
// This app cannot: it holds a session, not an api-rest bearer token, and minting
// one here would put a second token-issuing surface on the auth authority for
// the sake of one call. Publishing directly is the same event on the same bus,
// from a process that already publishes auth events this way
// (@sparx/auth's publishAuthEmail).
//
// Three things the api-rest path does that this deliberately does not, and why
// each is right to skip HERE:
//
//   • The in-process module cache flush. That cache is per-process and keyed by
//     tenant; a brand-new business has never been probed in any process, so
//     there is nothing to invalidate.
//   • The WizeWorks platform-CRM event. That bus records COMMERCIAL activity, and
//     under Piggles a module going on is not a commercial event — there is one
//     flat plan and nothing has been bought.
//   • The Stripe subscription-item sync. Piggles bills one flat plan, so
//     per-module line items would be an outright billing bug. (It is a no-op at
//     this moment regardless — the subscription is born at checkout — but the
//     reason to skip it is the pricing model, not the timing.)

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

/**
 * Expand a wanted set to include everything its members REQUIRE.
 *
 * Enabling B2B without Commerce is not a smaller feature set, it is a broken
 * one — the dependency graph is the platform's, and Piggles has to honour it
 * even though it charges for none of it.
 */
export function withRequirements(modules: readonly string[]): string[] {
  const out = new Set<string>();
  for (const module of modules) {
    out.add(module);
    for (const required of requiredModules(module as ModuleSlug)) out.add(required);
  }
  return [...out];
}

/**
 * The `settings.modules` fragment for a set of slugs, merged over whatever is
 * already there.
 *
 * Merged, never assigned: `settings` is a shared per-tenant blob and a module
 * already on for another reason must not be turned off by writing this one.
 */
export function moduleFlags(
  currentModules: Record<string, unknown> | undefined,
  modules: readonly string[]
): Prisma.InputJsonObject {
  const next: Record<string, unknown> = { ...(currentModules ?? {}) };
  for (const slug of modules) {
    const slot = (next[slug] as Record<string, unknown> | undefined) ?? {};
    next[slug] = { ...slot, enabled: true };
  }
  // Cast, and here is the honest reason: `settings` is read back as `unknown`
  // and Prisma's JSON input type refuses `Record<string, unknown>` because an
  // `unknown` value could be a function or a symbol. Everything in this object
  // came out of a `jsonb` column or was written by the line above, so it IS
  // JSON — TypeScript simply has no way to know that across the round trip.
  return next as Prisma.InputJsonObject;
}

/**
 * Announce the activations, AFTER the flags are committed.
 *
 * Order matters and only in this direction: a consumer that wakes up and reads
 * the flag must find it already true. The reverse — event first — races the
 * seeding against the write and can leave a module seeded but off.
 *
 * Best-effort by design. The flags are already saved, so a publish failure means
 * an app that works but arrives unseeded, which the owner can fix by using it.
 * Throwing here would instead undo a rename and a business name over a transport
 * hiccup. Failures are logged loudly enough to be found.
 */
export async function announceActivations(
  tenantId: string,
  actorId: string | null,
  modules: readonly string[]
): Promise<void> {
  if (modules.length === 0) return;
  const publisher = createPublisher({ logger });
  for (const module of modules) {
    try {
      await publishEvent(publisher, 'module.activated', tenantId, actorId, { module }, logger);
    } catch (err) {
      logger.error({ err, tenantId, module }, 'piggles onboarding: module.activated not published');
    }
  }
}
