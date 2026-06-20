// Activation defaults (docs/79 §15) — the template-agnostic structural rows the
// Scheduling module seeds when a tenant turns it on, so the module is usable
// immediately instead of empty. Driven by the api-rest module.activated consumer
// + nightly reconcile (lib/module-provisioning.ts), exactly like commerce/chat.
//
// Deliberately NOT sample business data: a real tenant's services, staff, and
// hours are theirs to author. We seed only the two structural defaults services
// and bookings attach to — a cancellation policy and a location — and only when
// the module is empty, so a tenant's own setup is never duplicated or clobbered.
// Re-running (re-activation or the 6h reconcile) is a safe no-op.

import { withTenant } from '@sparx/db';

export async function bootstrapSchedulingDefaults(tenantId: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    // A starter cancellation/reminder policy services can attach to. Seed only
    // into an empty module so a tenant's own policies are never duplicated.
    if ((await tx.bookingPolicy.count()) === 0) {
      await tx.bookingPolicy.create({
        data: {
          tenantId,
          name: 'Standard',
          depositType: 'none',
          cancellationWindowHours: 24,
          // 24h + 2h-before reminders (the worker reads these offsets, docs/79 §10).
          reminderOffsetsMin: [1440, 120],
          policyText: 'Please give at least 24 hours notice to cancel or reschedule.',
        },
      });
    }

    // A default location so multi-location features (and resource/service scoping)
    // have something to reference. Same empty-only guard.
    if ((await tx.businessLocation.count()) === 0) {
      await tx.businessLocation.create({
        data: { tenantId, name: 'Main location', timezone: 'UTC' },
      });
    }
  });
}
