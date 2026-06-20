// Quick local gate for the emitted Forge payload: imports the self-contained blueprint.ts
// and runs the real Zod + cross-reference validation (the same `parseBlueprint` the
// ingest uses), so a schema/integrity error surfaces here without needing a DB. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/validate-forge.ts"

import { parseBlueprint } from '../../packages/blueprints/src/index';
import bp from '../blueprints/forge/blueprint';

try {
  const m = parseBlueprint(bp as unknown);
  console.log(
    `VALID — ${m.key}@${m.version} | pages ${m.pages.length} | assets ${m.assets.length} | content ${m.content.length} | emails ${m.emails.length} | modules ${m.requiresModules.join(',')}`
  );
} catch (e) {
  console.error('INVALID:\n' + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
}
