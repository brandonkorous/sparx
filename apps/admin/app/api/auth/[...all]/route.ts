import { operatorAuth } from '@sparx/operator-auth';
import { toNextJsHandler } from 'better-auth/next-js';

// The OPERATOR Better Auth instance's handler (docs/apps/admin/build-plan.md §2
// D3) — sign-in, session, password reset for WizeWorks staff. Entirely separate
// from the tenant instance in the dashboard app; different domain, different
// cookie namespace, different identity store (the wize_admin schema).
export const { POST, GET } = toNextJsHandler(operatorAuth);
