// Mounts every /v1/staff/* route group (docs/149).
//
// Unlike finance, there is no free half: staff is a billable module end to end,
// so every file here calls `requireStaffModule` on every route. The split that
// DOES run through this directory is who may see money — `pay.ts` and
// `timesheets.ts` are `admin`, everything else answers to the ordinary
// viewer/editor ladder. The reasoning lives in `lib/staff-context.ts`.
//
// One register call from app.ts.

import type { FastifyPluginAsync } from 'fastify';

import staffMemberRoutes from './members.js';
import staffPayRoutes from './pay.js';
import staffTimeRoutes from './time.js';
import staffTimesheetRoutes from './timesheets.js';
import staffScheduleRoutes from './schedule.js';
import staffCertificationRoutes from './certifications.js';

const staffRoutes: FastifyPluginAsync = async (app) => {
  await app.register(staffMemberRoutes);
  await app.register(staffPayRoutes);
  await app.register(staffTimeRoutes);
  await app.register(staffTimesheetRoutes);
  await app.register(staffScheduleRoutes);
  await app.register(staffCertificationRoutes);
};

export default staffRoutes;
