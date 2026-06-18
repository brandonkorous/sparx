// Single source of truth for the agent version reported on heartbeat. Kept in sync
// with package.json by hand (the agent ships as a standalone binary, so it can't
// rely on reading its own package.json at runtime once bundled).
export const BRIDGE_VERSION = '0.1.0';
