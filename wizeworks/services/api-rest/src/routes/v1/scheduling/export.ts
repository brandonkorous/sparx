// Bookings, as a spreadsheet.
//
//   GET /v1/export/bookings → one row per booking
//
// Start and end are written as the wall-clock time in the booking's OWN zone
// ("2026-10-02 10:00"), with that zone in its own column. That is the time the
// customer was told and the time on the diary; the UTC instant is correct and
// recognizable to nobody.
//
// "Customer" follows the same ladder the diary uses: the name written on the
// booking, else the linked customer's name. The email and phone come from the
// linked customer and are blank for a walk-in nobody recorded.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { csvSafeText } from '@wizeworks/inventory';
import { listBookings, listLocations } from '@wizeworks/scheduling';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import { reachableSiteIds } from '../../../lib/property.js';
import {
  EXPORT_ROW_CAP,
  collectPages,
  sendCsvExport,
  wallTime,
} from '../../../lib/record-export.js';

const ExportQuery = z.object({
  status: z.string().max(20).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  take: z.coerce.number().int().min(1).max(EXPORT_ROW_CAP).optional(),
});

/** The list query's own page ceiling. */
const PAGE = 250;

// eslint-disable-next-line @typescript-eslint/require-await
const schedulingExportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/export/bookings', async (request, reply) => {
    await requireSchedulingModule(request);
    const auth = requireRole(request, 'viewer');
    const { tenantId } = toSchedulingContext(request);
    const q = ExportQuery.parse(request.query);
    // Bound to the member's reachable sites (docs/131 §3.3), as the list is:
    // a booking carries a customer's name, email and phone.
    const propertyIds = reachableSiteIds(auth);

    const bookings = await collectPages(PAGE, q.take ?? EXPORT_ROW_CAP, async (skip, take) => {
      const { rows, total } = await listBookings(tenantId, {
        status: q.status,
        from: q.from,
        to: q.to,
        propertyIds,
        order: 'desc',
        take,
        skip,
      });
      return { items: rows, total };
    });

    // The booking carries a location id; a spreadsheet needs its name.
    const locations = await listLocations(tenantId);
    const locationName = new Map(locations.map((l) => [l.id, l.name]));

    return sendCsvExport(reply, {
      name: 'bookings',
      headers: [
        'start',
        'end',
        'timezone',
        'kind',
        'service',
        'with',
        'customer_name',
        'customer_email',
        'customer_phone',
        'party_size',
        'status',
        'location',
        'notes',
        'booked_at',
      ],
      rows: bookings.map((b) => {
        const written = b.attendees.find((a) => a.guestName?.trim())?.guestName?.trim();
        const linked = b.customer
          ? [b.customer.firstName, b.customer.lastName].filter(Boolean).join(' ').trim()
          : '';
        return [
          wallTime(b.startAt, b.timezone),
          wallTime(b.endAt, b.timezone),
          b.timezone,
          b.bookingType,
          csvSafeText(b.service.name),
          // Staff, rooms and equipment held for it. A released hold (a
          // cancelled or no-show booking's) still names who it WAS with.
          csvSafeText(b.resources.map((r) => r.resource.name).join('; ') || null),
          csvSafeText(written ?? (linked !== '' ? linked : null)),
          b.customer?.email ?? null,
          csvSafeText(b.customer?.phone ?? null),
          b.partySize,
          b.status,
          csvSafeText(b.locationId ? (locationName.get(b.locationId) ?? null) : null),
          csvSafeText(b.notes),
          b.createdAt,
        ];
      }),
    });
  });
};

export default schedulingExportRoutes;
