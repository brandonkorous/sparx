import 'server-only';
import { withTenant } from '@wizeworks/db';
import type { HeardAbout } from './heard-about';

/** Record the owner's answer, MERGED into `settings` (other writers share it).
 *  Under `withTenant`, since the write must carry the tenant's own context. */
export async function saveHeardAbout(tenantId: string, answer: HeardAbout): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const current = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings =
      current.settings && typeof current.settings === 'object' && !Array.isArray(current.settings)
        ? (current.settings as Record<string, unknown>)
        : {};
    const acquisition = (settings.acquisition as Record<string, unknown> | undefined) ?? {};
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          acquisition: {
            ...acquisition,
            heardAbout: answer,
            heardAboutAt: new Date().toISOString(),
          },
        },
      },
    });
  });
}
