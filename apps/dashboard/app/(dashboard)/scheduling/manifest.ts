import type { ModuleManifest } from '@sparx/ui/shell';
import {
  CalendarClock,
  CalendarDays,
  Briefcase,
  Users,
  Clock,
  Hourglass,
  Repeat,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';

export const schedulingManifest: ModuleManifest = {
  id: 'scheduling',
  label: 'Scheduling',
  icon: CalendarClock,
  routePrefix: '/scheduling',
  sections: [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, href: '/scheduling/calendar' },
    { id: 'bookings', label: 'Bookings', icon: CalendarClock, href: '/scheduling/bookings' },
    { id: 'series', label: 'Recurring', icon: Repeat, href: '/scheduling/series' },
    { id: 'waitlist', label: 'Waitlist', icon: Hourglass, href: '/scheduling/waitlist' },
    { id: 'services', label: 'Services', icon: Briefcase, href: '/scheduling/services' },
    { id: 'policies', label: 'Policies', icon: ShieldCheck, href: '/scheduling/policies' },
    { id: 'resources', label: 'Resources', icon: Users, href: '/scheduling/resources' },
    { id: 'availability', label: 'Availability', icon: Clock, href: '/scheduling/availability' },
    { id: 'reports', label: 'Reports', icon: BarChart3, href: '/scheduling/reports' },
  ],
  actions: [],
  // service/resource/booking-policy are create-only overlay entities (no
  // `hasDetailView`: these list surfaces edit via a self-owned modal, not a
  // detail-view drawer). The manifest entry gives the create overlay chrome a
  // label + the "open in full page" href; the single-step SurfaceFrame create
  // opts into drawer/modal via CREATE_VIEW_TYPES + detail-slot.
  //
  // `booking` has BOTH a create overlay AND a detail view: a calendar block or a
  // bookings-list row opens the booking's detail (view + reschedule + lifecycle)
  // in the user's preferred surface, so it carries `hasDetailView: true`.
  entityTypes: [
    { id: 'service', label: 'Service', routePrefix: '/scheduling/services' },
    { id: 'resource', label: 'Resource', routePrefix: '/scheduling/resources' },
    { id: 'booking-policy', label: 'Booking policy', routePrefix: '/scheduling/policies' },
    {
      id: 'booking',
      label: 'Booking',
      routePrefix: '/scheduling/bookings',
      hasDetailView: true,
    },
  ],
};
