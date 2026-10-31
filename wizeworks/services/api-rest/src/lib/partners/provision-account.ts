// Provisioning an operator-approved partner's account (docs/114 §B.2).
//
// Approving an accountless partner needs a tenant + owner login + a
// set-password invite. That is Better Auth's work, and Better Auth lives in
// this process now (docs/154), so it runs here, on the sparx instance. It used
// to POST to the workbench's `/api/internal/partner-provision` with a shared
// secret, because the workbench held the only instance; an app holds no auth
// instance any more, and the hop is gone with it. api-rest owns the partner
// row either way.
//
// The partner program is sparx-only (see service.ts), so the brand is the
// default one rather than an unexamined constant.

import { provisionInvitedOwner, SignUpError } from '@wizeworks/auth';
import { DEFAULT_PLATFORM_BRAND } from '@wizeworks/brand-core';
import { runAsBrand } from '@wizeworks/brand-core/request-scope';

export type ProvisionAccountErrorCode = 'EMAIL_TAKEN' | 'INVALID_INPUT' | 'PROVISION_FAILED';

/** A typed provisioning failure. The approve path maps these to operator-facing
 *  errors (EMAIL_TAKEN → a clear "already has an account" conflict, the rest →
 *  a generic failure). */
export class ProvisionAccountError extends Error {
  constructor(
    public code: ProvisionAccountErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProvisionAccountError';
  }
}

export interface ProvisionedAccount {
  tenantId: string;
  userId: string;
  slug: string;
}

/** Provision a tenant + owner login for an approved-but-accountless applicant
 *  and trigger their set-password invite. Throws a typed ProvisionAccountError:
 *  EMAIL_TAKEN and INVALID_INPUT from the sign-up rules, PROVISION_FAILED for
 *  anything else. */
export async function provisionPartnerAccount(input: {
  email: string;
  name: string;
}): Promise<ProvisionedAccount> {
  try {
    const result = await runAsBrand(DEFAULT_PLATFORM_BRAND, () =>
      provisionInvitedOwner({ email: input.email, name: input.name })
    );
    return { tenantId: result.tenantId, userId: result.userId, slug: result.slug };
  } catch (err) {
    if (err instanceof SignUpError) {
      if (err.code === 'EMAIL_TAKEN') throw new ProvisionAccountError('EMAIL_TAKEN', err.message);
      if (err.code === 'INVALID_INPUT') {
        throw new ProvisionAccountError('INVALID_INPUT', err.message);
      }
    }
    process.stderr.write(
      JSON.stringify({
        severity: 'ERROR',
        source: 'api-rest.partner-provision',
        message: 'provisionInvitedOwner failed',
        err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      }) + '\n'
    );
    throw new ProvisionAccountError(
      'PROVISION_FAILED',
      err instanceof SignUpError ? err.message : 'Could not provision the account.'
    );
  }
}
