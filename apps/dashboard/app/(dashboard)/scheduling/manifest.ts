import type { ModuleManifest } from '@sparx/ui/shell';
import { CalendarClock, CalendarDays, Briefcase, Users, Clock, ShieldCheck } from 'lucide-react';

export const schedulingManifest: ModuleManifest = {
  id: 'scheduling',
  label: 'Scheduling',
  icon: CalendarClock,
  routePrefix: '/scheduling',
  sections: [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, href: '/scheduling' },
    { id: 'bookings', label: 'Bookings', icon: CalendarClock, href: '/scheduling/bookings' },
    { id: 'services', label: 'Services', icon: Briefcase, href: '/scheduling/services' },
    { id: 'policies', label: 'Policies', icon: ShieldCheck, href: '/scheduling/policies' },
    { id: 'resources', label: 'Resources', icon: Users, href: '/scheduling/resources' },
    { id: 'availability', label: 'Availability', icon: Clock, href: '/scheduling/availability' },
  ],
  actions: [],
  entityTypes: [],
};
