// Scheduling — appointments, jobs, and the time you have to give.

import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Clock,
  Hourglass,
  Link2,
  Repeat,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';

import { CalendarSurface } from '../../../surfaces/scheduling/calendar';
import { CalendarConnectionsSurface } from '../../../surfaces/scheduling/calendar-connections';
import { BookingsListSurface } from '../../../surfaces/scheduling/bookings-list';
import { BookingDetailSurface } from '../../../surfaces/scheduling/bookings-detail';
import { SeriesListSurface } from '../../../surfaces/scheduling/series-list';
import { SeriesDetailSurface } from '../../../surfaces/scheduling/series-detail';
import { WaitlistSurface } from '../../../surfaces/scheduling/waitlist-list';
import { ServicesListSurface } from '../../../surfaces/scheduling/services-list';
import { ServiceDetailSurface } from '../../../surfaces/scheduling/service-detail';
import { ResourcesListSurface } from '../../../surfaces/scheduling/resources-list';
import { ResourceDetailSurface } from '../../../surfaces/scheduling/resource-detail';
import { AvailabilitySurface } from '../../../surfaces/scheduling/availability-settings';
import { PoliciesListSurface } from '../../../surfaces/scheduling/policies-list';
import { PolicyDetailSurface } from '../../../surfaces/scheduling/policy-detail';
import { SchedulingReportsSurface } from '../../../surfaces/scheduling/reports';

export const SCHEDULING_SURFACES: SurfaceDefinition[] = [
  /* ── Diary ─────────────────────────────────────────────────────────────── */
  {
    key: 'scheduling.calendar',
    title: 'Calendar',
    module: 'scheduling',
    icon: CalendarDays,
    order: 1,
    keywords: ['diary', 'schedule', 'week', 'day', 'agenda'],
    component: CalendarSurface,
  },
  {
    key: 'scheduling.calendar.connections',
    title: 'Linked calendars',
    module: 'scheduling',
    icon: Link2,
    component: CalendarConnectionsSurface,
    listed: false,
    besideWidth: 0.42,
  },

  /* ── Bookings ──────────────────────────────────────────────────────────── */
  {
    key: 'scheduling.bookings.list',
    title: 'Bookings',
    module: 'scheduling',
    icon: CalendarClock,
    section: 'Bookings',
    order: 10,
    keywords: ['appointments', 'jobs', 'reservations'],
    component: BookingsListSurface,
    createSurface: 'scheduling.bookings.detail',
    createLabel: 'Take a booking',
  },
  {
    key: 'scheduling.bookings.detail',
    title: (params) => (params.id === 'new' ? 'New booking' : 'Booking'),
    module: 'scheduling',
    icon: CalendarClock,
    component: BookingDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'scheduling.series.list',
    title: 'Repeating bookings',
    module: 'scheduling',
    icon: Repeat,
    section: 'Bookings',
    order: 11,
    keywords: ['recurring', 'series', 'weekly', 'contract'],
    component: SeriesListSurface,
    createSurface: 'scheduling.series.detail',
    createLabel: 'Repeating booking',
  },
  {
    key: 'scheduling.series.detail',
    title: (params) => (params.id === 'new' ? 'New repeating booking' : 'Repeating booking'),
    module: 'scheduling',
    icon: Repeat,
    component: SeriesDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'scheduling.waitlist',
    title: 'Waiting list',
    module: 'scheduling',
    icon: Hourglass,
    section: 'Bookings',
    order: 12,
    keywords: ['waitlist', 'cancellations', 'standby'],
    component: WaitlistSurface,
  },

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  {
    key: 'scheduling.services.list',
    title: 'Services',
    module: 'scheduling',
    icon: Briefcase,
    section: 'Setup',
    order: 20,
    keywords: ['what you offer', 'duration', 'price'],
    component: ServicesListSurface,
    createSurface: 'scheduling.services.detail',
    createLabel: 'New service',
  },
  {
    key: 'scheduling.services.detail',
    title: (params) => (params.id === 'new' ? 'New service' : 'Service'),
    module: 'scheduling',
    icon: Briefcase,
    component: ServiceDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'scheduling.resources.list',
    title: 'People & equipment',
    module: 'scheduling',
    icon: Users,
    section: 'Setup',
    order: 21,
    keywords: ['resources', 'staff', 'rooms', 'bays', 'vehicles'],
    component: ResourcesListSurface,
    createSurface: 'scheduling.resources.detail',
    createLabel: 'Add one',
  },
  {
    key: 'scheduling.resources.detail',
    title: (params) => (params.id === 'new' ? 'New resource' : 'Resource'),
    module: 'scheduling',
    icon: Users,
    component: ResourceDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    key: 'scheduling.availability',
    title: 'Availability',
    module: 'scheduling',
    icon: Clock,
    section: 'Setup',
    order: 22,
    keywords: ['opening hours', 'working hours', 'holidays', 'time off'],
    component: AvailabilitySurface,
    singleton: true,
  },
  {
    key: 'scheduling.policies',
    title: 'Booking rules',
    module: 'scheduling',
    icon: ShieldCheck,
    section: 'Setup',
    order: 23,
    keywords: ['policies', 'cancellation', 'deposit', 'notice', 'no show'],
    component: PoliciesListSurface,
    createSurface: 'scheduling.policies.detail',
    createLabel: 'New rule set',
  },
  {
    key: 'scheduling.policies.detail',
    title: (params) => (params.id === 'new' ? 'New rule set' : 'Rule set'),
    module: 'scheduling',
    icon: ShieldCheck,
    component: PolicyDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },

  /* ── Reporting ─────────────────────────────────────────────────────────── */
  {
    key: 'scheduling.reports',
    title: 'Reports',
    module: 'scheduling',
    icon: BarChart3,
    section: 'Reporting',
    order: 30,
    keywords: ['utilisation', 'no shows', 'busiest', 'analytics', 'bookings', 'revenue'],
    component: SchedulingReportsSurface,
  },
];
