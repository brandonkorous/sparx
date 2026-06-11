// Email module-activation consumer (docs/82 Slice E4).
//
// Mirrors @sparx/crm's registerModuleActivationConsumers: when a tenant turns
// the Email module on, seed the default email automations (PRD §4) so the
// automations page isn't empty on first visit. provisionDefaults is idempotent
// (key-keyed upsert), so a duplicate `module.activated` is a safe no-op.
//
// This lives at the api-rest composition root rather than inside
// @sparx/email-platform on purpose: the in-process platform bus is owned by
// @sparx/crm, and email must not depend on CRM. api-rest is the one process that
// already imports both the bus and the email service, so wiring them together
// here keeps the package layering clean. It's also the process that PUBLISHES
// `module.activated` (routes/v1/tenant.ts), so the seed runs synchronously
// within the activation request — no eventual-consistency window.

import { automationService } from '@sparx/email-platform';
import { getPlatformBus } from '@sparx/crm';

/** Subscribe the email default-automation seed to `module.activated`. Returns
 *  the unsubscribe handle (mirrors the CRM consumer registrations). */
export function registerEmailModuleActivationConsumer(): () => void {
  const bus = getPlatformBus();
  return bus.subscribe('module.activated', async (event) => {
    const slug = (event.payload as { module?: string } | null)?.module;
    if (slug !== 'email') return;
    // The toggle route already invalidated the email module-gate cache before
    // publishing, so the new "email enabled" state is visible here.
    await automationService.provisionDefaults({ tenantId: event.tenantId, userId: undefined });
  });
}
