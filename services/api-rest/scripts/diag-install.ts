// TEMP diagnostic — calls installBlueprint directly to surface the real stack
// trace behind the dashboard's 500. Delete after.
import 'dotenv/config';

import { getBlueprint } from '@sparx/blueprints';
import { installBlueprint } from '../src/lib/blueprint-installer.js';

const TID = 'b44414a0-21b6-4d75-8d4e-59ea161d3826';
const UID = '6321a400-0219-4930-83d9-04b40f25dbb2';
const PROP_PERSONAL = 'e5c5bd19-3f21-4e6c-9cd6-36036bfed59d';

const logger = {
  info: (...a: unknown[]) => console.log('[info]', ...a),
  warn: (...a: unknown[]) => console.log('[warn]', ...a),
  error: (...a: unknown[]) => console.log('[error]', ...a),
  debug: () => {},
  fatal: (...a: unknown[]) => console.log('[fatal]', ...a),
  trace: () => {},
  child: () => logger,
} as unknown as Parameters<typeof installBlueprint>[0]['logger'];

const bp = getBlueprint('retail-store-blog');
if (!bp) throw new Error('blueprint not found');

try {
  const { installId, result } = await installBlueprint(
    { tenantId: TID, userId: UID, propertyId: PROP_PERSONAL, logger },
    bp
  );
  console.log('OK installId=', installId, 'counts=', result.counts);
} catch (err) {
  console.error('\n=== INSTALL FAILED ===');
  console.error(err);
  if (err instanceof Error && err.stack) console.error('\nSTACK:\n', err.stack);
}
process.exit(0);
