// Seed operator #1 (docs/apps/admin/build-plan.md §2 D10). There is no operator
// self-signup; the first operator is provisioned here, then `operator:admin`
// grants everyone else.
//
// Idempotent: safe to run on every deploy. If the operator exists we only
// re-assert their capabilities; we never reset a password. Provisioning a
// password requires OPERATOR_BOOTSTRAP_PASSWORD (a one-time Secret-Manager
// value the operator rotates on first sign-in); without it we create nothing
// and log guidance, so a fresh env fails safe rather than seeding a guessable
// credential.

import { operatorAuth } from './server';
import { operatorPool } from './db';
import { grantCapabilities } from './capabilities';
import { bundleCapabilities } from '@sparx/operator';

export interface SeedOperatorResult {
  created: boolean;
  operatorId: string;
  email: string;
}

export async function ensureSeedOperator(): Promise<SeedOperatorResult | null> {
  const email = (process.env.OPERATOR_SEED_EMAIL ?? 'brandon@wize.works').toLowerCase();
  const name = process.env.OPERATOR_SEED_NAME ?? 'Brandon Korous';
  const password = process.env.OPERATOR_BOOTSTRAP_PASSWORD;

  const existing = await operatorPool.query<{ id: string }>(
    'SELECT id FROM wize_admin.platform_operators WHERE email = $1',
    [email]
  );
  const found = existing.rows[0];
  if (found) {
    // Already seeded — just re-assert super_admin (idempotent grant).
    await grantCapabilities(found.id, bundleCapabilities('super_admin'), null);
    return { created: false, operatorId: found.id, email };
  }

  if (!password) {
    console.warn(
      '[operator-auth] OPERATOR_BOOTSTRAP_PASSWORD is unset — skipping operator #1 seed. ' +
        'Set it (Secret Manager) once to provision the first operator; rotate it on first sign-in.'
    );
    return null;
  }

  const res = await operatorAuth.api.signUpEmail({ body: { email, password, name } });
  const userId = (res as { user?: { id?: string } }).user?.id;
  if (!userId) {
    throw new Error('operator seed: signUpEmail returned no user id.');
  }
  // Operators are trusted from creation; mark verified so no verification gate.
  await operatorPool.query(
    'UPDATE wize_admin.platform_operators SET "emailVerified" = true WHERE id = $1',
    [userId]
  );
  await grantCapabilities(userId, bundleCapabilities('super_admin'), null);
  return { created: true, operatorId: userId, email };
}
