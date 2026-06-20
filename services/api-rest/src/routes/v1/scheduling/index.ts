import type { FastifyPluginAsync } from 'fastify';
import schedulingServiceRoutes from './services.js';
import schedulingResourceRoutes from './resources.js';
import schedulingAvailabilityRoutes from './availability.js';
import schedulingBookingRoutes from './bookings.js';

const schedulingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(schedulingServiceRoutes);
  await app.register(schedulingResourceRoutes);
  await app.register(schedulingAvailabilityRoutes);
  await app.register(schedulingBookingRoutes);
};

export default schedulingRoutes;
