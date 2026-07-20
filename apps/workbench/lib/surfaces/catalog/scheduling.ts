// Scheduling — appointments, jobs, and the time you have to give.

import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Clock,
  Hourglass,
  Repeat,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { stub } from './stub';

export const SCHEDULING_SURFACES: SurfaceDefinition[] = [
  stub({
    key: 'scheduling.calendar',
    title: 'Calendar',
    module: 'scheduling',
    icon: CalendarDays,
    order: 1,
    keywords: ['diary', 'schedule', 'week', 'day', 'agenda'],
    body: 'Everything booked in, laid out by day and week.',
  }),

  /* ── Bookings ──────────────────────────────────────────────────────────── */
  stub({
    key: 'scheduling.bookings.list',
    title: 'Bookings',
    module: 'scheduling',
    icon: CalendarClock,
    section: 'Bookings',
    order: 10,
    keywords: ['appointments', 'jobs', 'reservations'],
    body: 'Every appointment as a list you can search — who, what, when, and whether it is confirmed.',
  }),
  stub({
    key: 'scheduling.series.list',
    title: 'Repeating bookings',
    module: 'scheduling',
    icon: Repeat,
    section: 'Bookings',
    order: 11,
    keywords: ['recurring', 'series', 'weekly', 'contract'],
    body: 'Appointments that happen on a regular pattern — every Tuesday, or the first of each month.',
  }),
  stub({
    key: 'scheduling.waitlist',
    title: 'Waiting list',
    module: 'scheduling',
    icon: Hourglass,
    section: 'Bookings',
    order: 12,
    keywords: ['waitlist', 'cancellations', 'standby'],
    body: 'People who want a slot that is full, so a cancellation can be filled instead of lost.',
  }),

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  stub({
    key: 'scheduling.services.list',
    title: 'Services',
    module: 'scheduling',
    icon: Briefcase,
    section: 'Setup',
    order: 20,
    keywords: ['what you offer', 'duration', 'price'],
    body: 'What people can book you for, how long each one takes, and what it costs.',
  }),
  stub({
    key: 'scheduling.resources.list',
    title: 'People & equipment',
    module: 'scheduling',
    icon: Users,
    section: 'Setup',
    order: 21,
    keywords: ['resources', 'staff', 'rooms', 'bays', 'vehicles'],
    body: 'Whatever a booking uses up — a member of staff, a room, a bay, a machine. Two bookings cannot claim the same one.',
  }),
  stub({
    key: 'scheduling.availability',
    title: 'Availability',
    module: 'scheduling',
    icon: Clock,
    section: 'Setup',
    order: 22,
    keywords: ['opening hours', 'working hours', 'holidays', 'time off'],
    body: 'The hours you can be booked, and the days you cannot — holidays, closures, time off.',
  }),
  stub({
    key: 'scheduling.policies',
    title: 'Booking rules',
    module: 'scheduling',
    icon: ShieldCheck,
    section: 'Setup',
    order: 23,
    keywords: ['policies', 'cancellation', 'deposit', 'notice', 'no show'],
    body: 'How much notice you need, what happens on a cancellation, and whether a deposit is taken up front.',
  }),

  /* ── Reporting ─────────────────────────────────────────────────────────── */
  stub({
    key: 'scheduling.reports',
    title: 'Reports',
    module: 'scheduling',
    icon: BarChart3,
    section: 'Reporting',
    order: 30,
    keywords: ['utilisation', 'no shows', 'busiest'],
    body: 'How full your diary runs, when you are busiest, and how often people fail to turn up.',
  }),
];
