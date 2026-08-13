// Certifications (docs/149 §5) — the surface that earns this module for a
// regulated trade. A licence that lapsed is a van that cannot leave the yard,
// and nobody finds out from a spreadsheet.
//
//   GET    /v1/staff/certifications        → soonest expiry first
//   POST   /v1/staff/certifications
//   PATCH  /v1/staff/certifications/:id
//   DELETE /v1/staff/certifications/:id
//
// `viewer` to read: knowing whose ticket has run out is a dispatch fact, not a
// pay fact — the person who has to decide who drives today is exactly who needs
// it, and they are rarely an admin.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  createCertification,
  deleteCertification,
  getMember,
  listCertifications,
  updateCertification,
} from '@sparx/staff';
import { certificationSchema } from '@sparx/staff/schemas';
import { requireStaffModule } from '../../../lib/staff-context.js';
import { certificationView, displayName } from './views.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  staffMemberId: z.string().uuid().optional(),
  /** Narrow to what needs attention. Absent = everything, including the
   *  never-expiring ones, which sort last. */
  expiringWithinDays: z.coerce.number().int().min(0).max(3650).optional(),
});

const CertificationUpdate = certificationSchema.omit({ staffMemberId: true }).partial();

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const staffCertificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/staff/certifications', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'viewer');
    const query = ListQuery.parse(request.query);
    const rows = await listCertifications(auth.tenantId, query);
    const today = new Date();
    const items = rows.map((row) => ({
      ...certificationView(row, today),
      staffMemberName: displayName(row.staffMember),
      staffMemberStatus: row.staffMember.status,
    }));
    return ok({
      items,
      // The two counts the screen leads with. Computed here so "expiring" means
      // the same thing on this list as it does on the roster badge — it depends
      // on each certification's own lead time, which is not something a client
      // should be re-deriving.
      expiredCount: items.filter((item) => item.state === 'expired').length,
      expiringCount: items.filter((item) => item.state === 'expiring').length,
    });
  });

  app.post('/v1/staff/certifications', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const input = certificationSchema.parse(request.body);
    await getMember(auth.tenantId, input.staffMemberId);
    const row = await createCertification(auth.tenantId, input);
    return reply.code(201).send(ok(certificationView(row, new Date())));
  });

  app.patch('/v1/staff/certifications/:id', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = CertificationUpdate.parse(request.body);
    const row = await updateCertification(auth.tenantId, id, input);
    return ok(certificationView(row, new Date()));
  });

  app.delete('/v1/staff/certifications/:id', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await deleteCertification(auth.tenantId, id);
    return reply.code(204).send();
  });
};

export default staffCertificationRoutes;
