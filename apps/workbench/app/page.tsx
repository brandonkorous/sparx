import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@sparx/auth';
import { WorkbenchShell } from '../components/workbench-shell';

// The workbench is a single route. There is no /commerce, no /invoicing/[id] —
// what you are looking at is the layout, not the URL, and the layout is restored
// from the device rather than parsed from a path. The one exception is `?open=`,
// a deep link that opens a surface into the existing layout without replacing
// it (see lib/surfaces/descriptor.ts).
export const dynamic = 'force-dynamic';

export default async function WorkbenchPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  // Read the active-site cookie server-side and hand it down as the boot key.
  // /api/token forwards this SAME cookie as `propertyId`, and the shell already
  // trusts that value as the per-site layout key — so surfacing it at SSR lets
  // the dock and toolbar mount on the first paint instead of after a token
  // round trip, for everyone who has picked a site before (the common case).
  const cookieStore = await cookies();
  const initialSiteKey = cookieStore.get('sparx_active_property')?.value ?? null;

  return (
    <WorkbenchShell
      userName={displayName(session.user.name, session.user.email)}
      userEmail={session.user.email}
      initialSiteKey={initialSiteKey}
    />
  );
}

/**
 * `name` is nullable AND can be a blank string, so neither `??` (which keeps '')
 * nor a bare truthiness check (which trips the nullish-coalescing lint rule)
 * covers both cases on its own.
 */
function displayName(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return email;
  return trimmed;
}
