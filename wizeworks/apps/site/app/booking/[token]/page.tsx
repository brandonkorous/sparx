// Change or cancel one appointment, from the link in the confirmation.
//
// No account and no phone call (issue 153). The token in the address IS the
// credential — it went to the address the customer typed into the booking form
// and nowhere else — so this route reads it out of the path and hands it to the
// client, which does everything through the signed manage endpoints.
//
// `noindex`: the address names one person's appointment. It should never be in a
// search result, and a crawler that follows a link out of a forwarded email
// should get nothing.

import { notFound } from 'next/navigation';

import { ManageBooking } from '@/components/booking/manage-booking';
import { resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your appointment',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ManageBookingPage({ params }: Props) {
  // ManageBooking calls useCustomer(), whose provider the root layout renders
  // only for a resolved site: with no site this was a 500, not a 404.
  if (!(await resolveSite())) notFound();
  const { token } = await params;
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <ManageBooking token={token} />
    </div>
  );
}
