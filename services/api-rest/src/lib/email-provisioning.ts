// Default-email provisioning — the in-process consumer that materializes a
// tenant's 13 default Builder emails (docs/91) when the email module activates.
//
// The SECOND writer on `module.activated(email)` (docs/91 §7). The automation
// module separately seeds its email-sending system automations (in the
// automation-worker, off the Pub/Sub leg); this provisions the BuilderEmail rows
// those automations send by KEY — getPublishedByKey is the dispatch-time join.
// Different tables, same event, so the two writers never collide.
//
// Runs in THIS api-rest process against the same in-process platform bus the CRM
// activation consumers use (registry.ts) — NOT inside @sparx/crm, which would
// force a crm→builder package dependency. publishPlatformEvent awaits every
// subscriber, so the seed completes before the tenant-module route returns (no
// separate /bootstrap round-trip). provisionDefaultEmails is idempotent — only
// the missing keys are created — so a re-activation or duplicate event is a safe
// no-op.

import { emailService } from '@sparx/builder';
import { getPlatformBus, type PlatformEvent } from '@sparx/crm';

/** Subscribe the default-email provisioner to `module.activated`. Returns the
 *  unsubscribe handle (api-rest holds it for the process lifetime; tests drop it
 *  on teardown). Mirrors registerModuleActivationConsumers in @sparx/crm, but
 *  lives here to keep @sparx/crm free of a @sparx/builder dependency. */
export function registerEmailProvisioningConsumer(): () => void {
  const bus = getPlatformBus();
  return bus.subscribe('module.activated', async (event: PlatformEvent) => {
    const slug = (event.payload as { module?: string } | null)?.module;
    if (slug !== 'email') return;
    await emailService.provisionDefaultEmails({ tenantId: event.tenantId, userId: undefined });
  });
}
