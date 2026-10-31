import type { Business } from './account-load';

// Has this business never been set up? Setup is what switches its apps on, so a
// business with NO app on and no finished-setup marker has plainly skipped it (a
// Google account made from the sign-in page). Seeded businesses have apps on.

/** Whether Piggles' finished-setup marker is on the business. */
export function isOnboarded(business: Pick<Business, 'brandSettings'>): boolean {
  const at = business.brandSettings.onboardedAt;
  return typeof at === 'string' && at.length > 0;
}

export function needsSetup(business: Pick<Business, 'brandSettings' | 'modulesEnabled'>): boolean {
  return !isOnboarded(business) && business.modulesEnabled.length === 0;
}
