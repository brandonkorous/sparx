// sparx Scheduling — schema package barrel (docs/79-scheduling.md).
//
// Single source of truth for the shape of every Server Action / REST / MCP write
// into the Scheduling module. The service layer (@sparx/scheduling), the public
// booking widget, the dashboard, and the MCP tools all validate inputs against
// these Zod schemas before touching Prisma — keeping the column + JSONB writes
// type-safe across every transport.

export * from './common';
export * from './resources';
export * from './services';
export * from './availability';
export * from './bookings';
export * from './policies';
export * from './intake';
export * from './calendar';
export * from './waitlist';
