import 'server-only';

import { platformRequest } from '@wizeworks/auth-client-server';
import type { SignUpAcquisition } from '@wizeworks/auth';

/**
 * Record a Google signup's source, ONCE. The password path writes it at
 * creation; a Google signup passes through the provider's redirect and loses
 * the link on the way, so the first page after it records it here.
 *
 * api-rest writes it only on a business made in the last hour that has no
 * source yet: long enough for a slow Google round trip, short enough that an
 * old link can never rewrite a real source.
 */
export async function recordAcquisitionOnce(acq: SignUpAcquisition | null): Promise<void> {
  if (!acq) return;
  await platformRequest('business/acquisition', { body: acq });
}
