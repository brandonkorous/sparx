import type { FastifyPluginAsync } from 'fastify';
import schedulingServiceRoutes from './services.js';
import schedulingLocationRoutes from './locations.js';
import schedulingResourceRoutes from './resources.js';
import schedulingAvailabilityRoutes from './availability.js';
import schedulingBookingRoutes from './bookings.js';
import schedulingPolicyRoutes from './policies.js';
import schedulingCalendarConnectionRoutes from './calendar.js';
import schedulingSeriesRoutes from './series.js';
import schedulingWaitlistRoutes from './waitlist.js';
import schedulingClassRoutes from './classes.js';
import schedulingReportRoutes from './reports.js';

const schedulingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(schedulingServiceRoutes);
  await app.register(schedulingLocationRoutes);
  await app.register(schedulingResourceRoutes);
  await app.register(schedulingAvailabilityRoutes);
  await app.register(schedulingBookingRoutes);
  await app.register(schedulingPolicyRoutes);
  await app.register(schedulingCalendarConnectionRoutes);
  await app.register(schedulingSeriesRoutes);
  await app.register(schedulingWaitlistRoutes);
  await app.register(schedulingClassRoutes);
  await app.register(schedulingReportRoutes);
};

export default schedulingRoutes;
