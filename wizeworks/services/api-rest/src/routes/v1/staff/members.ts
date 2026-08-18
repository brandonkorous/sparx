// The roster and the person (docs/149 §5 — People, Person).
//
//   GET    /v1/staff/members              → the roster
//   POST   /v1/staff/members              → add someone
//   GET    /v1/staff/members/:id          → one person, with their file
//   PATCH  /v1/staff/members/:id          → correct them
//   POST   /v1/staff/members/:id/archive  → they left
//   POST   /v1/staff/members/:id/restore  → they came back
//   DELETE /v1/staff/members/:id          → the record was a mistake
//   GET    /v1/staff/members/:id/documents
//   POST   /v1/staff/documents
//   PATCH  /v1/staff/documents/:id
//   DELETE /v1/staff/documents/:id
//
// `property` follows the platform list-scope convention: absent ⇒ the active
// site, `all` ⇒ every site this member may reach. Someone can work for two of an
// owner's businesses, so a person reachable from either site's roster is normal
// rather than a leak.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import {
  addDocument,
  archiveMember,
  createMember,
  deleteDocument,
  deleteMember,
  getMember,
  listDocuments,
  listMembers,
  restoreMember,
  updateDocument,
  updateMember,
} from '@wizeworks/staff';
import {
  documentSchema,
  staffMemberCreateSchema,
  staffMemberUpdateSchema,
  staffStatusSchema,
} from '@wizeworks/staff/schemas';
import { canSeePay, requirePayAccess, requireStaffModule } from '../../../lib/staff-context.js';
import { publishStaffEvent } from '../../../lib/staff-events.js';
import { resolveListScopeIds } from '../../../lib/property.js';
import { memberView, type StaffMemberRow } from './views.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  status: staffStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  includeArchived: queryBool.optional(),
  property: z.string().optional(),
});

const DocumentUpdate = documentSchema
  .omit({ staffMemberId: true, assetId: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change.' });

function documentView(row: {
  id: string;
  staffMemberId: string;
  assetId: string;
  kind: string;
  title: string;
  signedAt: Date | null;
  expiresOn: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    staffMemberId: row.staffMemberId,
    assetId: row.assetId,
    kind: row.kind,
    title: row.title,
    signedAt: row.signedAt,
    expiresOn: row.expiresOn,
    createdAt: row.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const staffMemberRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/staff/members', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'viewer');
    const query = ListQuery.parse(request.query);
    const propertyIds = await resolveListScopeIds(
      auth,
      query.property,
      request.headers['x-sparx-property-id']
    );
    // The service filters on ONE site; a wider scope reads the whole roster.
    const propertyId = propertyIds?.length === 1 ? propertyIds[0] : undefined;
    const rows = await listMembers(auth.tenantId, {
      status: query.status,
      search: query.search,
      includeArchived: query.includeArchived,
      propertyId,
    });
    const today = new Date();
    const pay = canSeePay(auth);
    return ok({ items: rows.map((row) => memberView(row as StaffMemberRow, today, pay)) });
  });

  app.post('/v1/staff/members', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const input = staffMemberCreateSchema.parse(request.body);
    const row = await createMember(auth.tenantId, input);
    await publishStaffEvent('staff.member.created', auth.tenantId, auth.actorId, {
      staffMemberId: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
    });
    return reply.code(201).send(ok(memberView(row as StaffMemberRow, new Date(), canSeePay(auth))));
  });

  app.get('/v1/staff/members/:id', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const row = await getMember(auth.tenantId, id);
    return ok(memberView(row as StaffMemberRow, new Date(), canSeePay(auth)));
  });

  app.patch('/v1/staff/members/:id', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = staffMemberUpdateSchema.parse(request.body);
    const row = await updateMember(auth.tenantId, id, input);
    return ok(memberView(row as StaffMemberRow, new Date(), canSeePay(auth)));
  });

  // Archive, not delete — their hours are in last year's profit figure, and a
  // deleted person leaves that number with no subject (members.ts explains it at
  // length). The roster hides them; the history keeps them.
  app.post('/v1/staff/members/:id/archive', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await getMember(auth.tenantId, id); // 404 rather than a raw Prisma P2025.
    const row = await archiveMember(auth.tenantId, id);
    return ok(memberView(row as StaffMemberRow, new Date(), canSeePay(auth)));
  });

  app.post('/v1/staff/members/:id/restore', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await getMember(auth.tenantId, id);
    const row = await restoreMember(auth.tenantId, id);
    return ok(memberView(row as StaffMemberRow, new Date(), canSeePay(auth)));
  });

  // The genuine delete, for a record created in error. `admin`, not `editor`:
  // this takes their timesheet and their certifications with it, and the archive
  // above is what an ordinary "they left" is meant to use.
  app.delete('/v1/staff/members/:id', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    await getMember(auth.tenantId, id);
    await deleteMember(auth.tenantId, id);
    return reply.code(204).send();
  });

  // ── Documents ────────────────────────────────────────────────────────────
  // A personnel file: contracts, signed handbooks, an ID scan. `admin`, for the
  // same reason pay is (staff-context.ts) — this is the drawer in the back
  // office, not the roster on the wall.

  app.get('/v1/staff/members/:id/documents', async (request) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const { id } = PathId.parse(request.params);
    await getMember(auth.tenantId, id);
    const rows = await listDocuments(auth.tenantId, id);
    return ok({ items: rows.map(documentView) });
  });

  app.post('/v1/staff/documents', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const input = documentSchema.parse(request.body);
    await getMember(auth.tenantId, input.staffMemberId);
    const row = await addDocument(auth.tenantId, input);
    return reply.code(201).send(ok(documentView(row)));
  });

  app.patch('/v1/staff/documents/:id', async (request) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const { id } = PathId.parse(request.params);
    const input = DocumentUpdate.parse(request.body);
    return ok(documentView(await updateDocument(auth.tenantId, id, input)));
  });

  app.delete('/v1/staff/documents/:id', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const { id } = PathId.parse(request.params);
    await deleteDocument(auth.tenantId, id);
    return reply.code(204).send();
  });
};

export default staffMemberRoutes;
