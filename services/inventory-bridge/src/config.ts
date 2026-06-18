// Agent configuration — read from the environment (or a .env file the installer
// drops next to the binary). Validated on boot; a bad config exits non-zero with a
// clear message rather than failing mid-loop.

import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z
  .object({
    // ── sparx connection ──
    SPARX_BASE_URL: z.string().url(),
    SPARX_SOURCE_ID: z.string().uuid(),
    SPARX_API_KEY: z.string().startsWith('sk_live_'),

    // ── what to read ──
    BRIDGE_READER: z.enum(['file', 'fishbowl']).default('file'),
    BRIDGE_FILE_PATH: z.string().optional(),
    BRIDGE_FILE_FORMAT: z.enum(['csv', 'json']).default('csv'),

    // ── cadence ──
    SYNC_INTERVAL_SEC: z.coerce.number().int().min(30).max(86_400).default(300),
    HEARTBEAT_INTERVAL_SEC: z.coerce.number().int().min(15).max(3_600).default(60),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  })
  .refine((c) => c.BRIDGE_READER !== 'file' || !!c.BRIDGE_FILE_PATH, {
    message: 'BRIDGE_FILE_PATH is required when BRIDGE_READER=file',
    path: ['BRIDGE_FILE_PATH'],
  });

export type BridgeConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[inventory-bridge] invalid configuration:\n${issues}`);
  }
  return result.data;
}
