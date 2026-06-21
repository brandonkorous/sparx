import type { FastifyPluginAsync } from 'fastify';
import schedulingServiceRoutes from './services.js';
import schedulingResourceRoutes from './resources.js';
import schedulingAvailabilityRoutes from './availability.js';
import schedulingBookingRoutes from './bookings.js';
import schedulingPolicyRoutes from './policies.js';
import schedulingCalendarConnectionRoutes from './calendar.js';

const schedulingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(schedulingServiceRoutes);
  await app.register(schedulingResourceRoutes);
  await app.register(schedulingAvailabilityRoutes);
  await app.register(schedulingBookingRoutes);
  await app.register(schedulingPolicyRoutes);
  await app.register(schedulingCalendarConnectionRoutes);
};

export default schedulingRoutes;
