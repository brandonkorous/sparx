import { redirect } from 'next/navigation';
import { getSession } from '@sparx/auth';

// The workbench is a single route; a surface is reached by a `?open=<descriptor>`
// deep link on `/` (see lib/surfaces/descriptor.ts + lib/dock/dock.tsx). But
// emails and notifications from the backend build stable, human-readable paths
// like /settings/domains — and they must keep working now that the workbench
// serves app.sparx.works. These thin redirect routes translate a friendly path
// into the equivalent `?open=` deep link, keeping the readable URL out of the
// emitters (which must not hardcode dock surface keys).

/**
 * Redirect a legacy human-readable path to its workbench surface deep link,
 * preserving intent across sign-in for a logged-out visitor (e.g. someone
 * clicking an email link cold): if there's no session, route through /sign-in
 * with the `?open=` target as the callbackURL so they land on the pane after
 * authenticating instead of a bare shell.
 *
 * @param descriptor an encoded pane descriptor — `<surface>` or
 *   `<surface>?<param>=<value>` (encodeDescriptor's format).
 */
export async function redirectToSurface(descriptor: string): Promise<never> {
  const target = `/?${new URLSearchParams({ open: descriptor }).toString()}`;
  const session = await getSession();
  if (!session) redirect(`/sign-in?callbackURL=${encodeURIComponent(target)}`);
  redirect(target);
}
