// @wizeworks/automation-schemas — the typed automation rule document.
//
// Single source of truth for the shape of every automation write (REST / MCP /
// seed) and the persisted run/step/gate-log vocabularies. The engine
// (@wizeworks/automation), api-rest routes, and the dashboard Server Actions all
// validate against these before touching Prisma.

export * from './condition';
export * from './evaluate';
export * from './trigger';
export * from './action';
export * from './run';
export * from './automation';
