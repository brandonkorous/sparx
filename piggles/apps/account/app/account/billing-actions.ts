'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireSession } from '@wizeworks/auth';
import { openCheckout, openPortal } from '@/lib/billing';
import { canPay } from '@/lib/pay-roles';

/** This page's own address, as the person reached it, for Stripe to send them back to. */
async function accountReturnUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3021';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/account`;
}

/** Off to Stripe to put a card on file. Owners and admins only. */
export async function startCheckoutAction(): Promise<void> {
  const session = await requireSession();
  if (!canPay(session.user.role)) redirect('/account?billing=not-allowed');
  const result = await openCheckout(session.user.tenantId, await accountReturnUrl()).catch(
    () => null
  );
  if (result?.url) redirect(result.url);
  redirect(`/account?billing=${result && 'reason' in result ? result.reason : 'failed'}`);
}

/** Off to Stripe's billing page: invoices, the card, cancelling. */
export async function openPortalAction(): Promise<void> {
  const session = await requireSession();
  if (!canPay(session.user.role)) redirect('/account?billing=not-allowed');
  const url = await openPortal(session.user.tenantId, await accountReturnUrl()).catch(() => null);
  redirect(url ?? '/account?billing=failed');
}
