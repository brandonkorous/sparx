import { DetailPageShell } from '../../../_components/detail-page-shell';
import { BookingDetailContent } from './_content';

// Full-page host for a booking detail. The same server-rendered body also mounts
// in the dashboard shell's drawer / modal panel (registered in detail-slot.tsx);
// here the shell supplies the back-link, the teleported lifecycle actions, and
// the drawer/modal presentation switch.

export const dynamic = 'force-dynamic';

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="booking" entityId={id} listLabel="Bookings">
      <BookingDetailContent id={id} />
    </DetailPageShell>
  );
}
