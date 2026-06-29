import { api } from '@/lib/api-rest-client';
import type { SchedulingService } from '../../_lib/types';
import { BookingForm } from '../_components/booking-form';

// Full-page surface for creating a booking. The surface-aware `BookingForm`
// renders the SAME SurfaceFrame here (`presentation="page"`) and inside the
// `@detail` drawer/modal overlay (`presentation="overlay"`). Both feed it the
// tenant's services (the form filters to the active, bookable ones) — no
// page-level Container/PageHeader, so the embedded frame supplies the title.

export const dynamic = 'force-dynamic';

export default async function NewBookingPage() {
  const services = await api
    .get<SchedulingService[]>('/v1/scheduling/services')
    .catch(() => [] as SchedulingService[]);
  return <BookingForm presentation="page" services={services} />;
}
