import { redirect } from 'next/navigation';
import { getSession } from '@wizeworks/auth';

export const dynamic = 'force-dynamic';

// getpiggles.com/ is a junction, not a page.
//
// Nobody types this address wanting to look at it — they arrive from a "sign in"
// link, from the console bouncing them, or from a bookmark made while managing
// their subscription. So it sends them to whichever of those they were plainly
// after and renders nothing itself.
//
// The signed-in destination is the account home (subscription, capacity,
// invoices), NOT the console. Somebody deliberately visiting getpiggles.com is
// dealing with WizeWorks; the route to their own business is /handoff, and
// conflating the two is the exact confusion this app was split out to end.
export default async function AccountRoot() {
  const session = await getSession();
  redirect(session ? '/account' : '/sign-in');
}
