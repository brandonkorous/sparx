// Scheduling catalog tools (docs/113 §6) — list bookable services, check open
// slots, and BOOK as a guest (name/email inline, no login). Wraps the routes
// under /v1/public/scheduling. Module-gated on `scheduling` downstream.

import { z } from 'zod';
import type { SiteTool } from '../types.js';

const iso = z.string().datetime({ offset: true });
const serviceId = z.string().uuid();
const guest = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(32).optional(),
});

const listServices: SiteTool = {
  name: 'list_services',
  description:
    'List services a customer can book online (name, duration, price, capacity, booking type).',
  kind: 'read',
  module: 'scheduling',
  input: z.object({}),
  call: (client) => client.request({ method: 'GET', path: '/v1/public/scheduling/services' }),
};

const getServiceResources: SiteTool = {
  name: 'get_service_resources',
  description:
    'For a service that lets the customer choose a provider/resource (stylist, room, table…), list the pickable options.',
  kind: 'read',
  module: 'scheduling',
  input: z.object({ serviceId }),
  call: (client, _ctx, input) => {
    const { serviceId: id } = input as { serviceId: string };
    return client.request({
      method: 'GET',
      path: `/v1/public/scheduling/services/${encodeURIComponent(id)}/resources`,
    });
  },
};

const checkAvailability: SiteTool = {
  name: 'check_availability',
  description:
    'Open appointment slots for a service in a date/time window. Returns {startAt, endAt, remaining}. Use before booking.',
  kind: 'read',
  module: 'scheduling',
  input: z.object({
    serviceId,
    from: iso.describe('Window start (ISO 8601).'),
    to: iso.describe('Window end (ISO 8601).'),
    partySize: z.number().int().min(1).max(100000).optional(),
    resourceId: z.string().uuid().optional(),
  }),
  call: (client, _ctx, input) =>
    client.request({
      method: 'GET',
      path: '/v1/public/scheduling/availability',
      query: input as Record<string, string>,
    }),
};

const listClassSessions: SiteTool = {
  name: 'list_class_sessions',
  description: 'Open class/group sessions for a service in a window (with remaining seats).',
  kind: 'read',
  module: 'scheduling',
  input: z.object({ serviceId, from: iso, to: iso }),
  call: (client, _ctx, input) =>
    client.request({
      method: 'GET',
      path: '/v1/public/scheduling/sessions',
      query: input as Record<string, string>,
    }),
};

const bookAppointment: SiteTool = {
  name: 'book_appointment',
  description:
    'Book an appointment for a service at a start time. Guest booking — provide the customer’s name + email; no account needed. Confirm the slot with check_availability first.',
  kind: 'guest_write',
  module: 'scheduling',
  input: z.object({
    serviceId,
    startAt: iso,
    partySize: z.number().int().min(1).max(100000).optional(),
    customer: guest,
    notes: z.string().max(2000).optional(),
    resourceId: z.string().uuid().optional(),
  }),
  call: (client, _ctx, input) =>
    client.request({ method: 'POST', path: '/v1/public/scheduling/bookings', body: input }),
};

const joinWaitlist: SiteTool = {
  name: 'join_waitlist',
  description: 'Join the waitlist for a service across a desired window when no slot is open.',
  kind: 'guest_write',
  module: 'scheduling',
  input: z.object({
    serviceId,
    customer: guest,
    desiredFrom: iso,
    desiredTo: iso,
  }),
  call: (client, _ctx, input) =>
    client.request({ method: 'POST', path: '/v1/public/scheduling/waitlist', body: input }),
};

const joinClass: SiteTool = {
  name: 'join_class',
  description: 'Take a seat in an open class session (by session/booking id).',
  kind: 'guest_write',
  module: 'scheduling',
  input: z.object({
    sessionId: z.string().uuid(),
    customer: guest,
    partySize: z.number().int().min(1).max(100000).optional(),
  }),
  call: (client, _ctx, input) => {
    const { sessionId, ...body } = input as Record<string, unknown> & { sessionId: string };
    return client.request({
      method: 'POST',
      path: `/v1/public/scheduling/sessions/${encodeURIComponent(sessionId)}/join`,
      body,
    });
  },
};

export const schedulingTools: SiteTool[] = [
  listServices,
  getServiceResources,
  checkAvailability,
  listClassSessions,
  bookAppointment,
  joinWaitlist,
  joinClass,
];
