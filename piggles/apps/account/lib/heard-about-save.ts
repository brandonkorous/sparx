import 'server-only';

import { platformRequest } from '@wizeworks/auth-client-server';
import type { HeardAbout } from './heard-about';

/** Record the owner's answer. api-rest merges it into the business settings
 *  (other writers share them), for the business of the person signed in. */
export async function saveHeardAbout(answer: HeardAbout): Promise<void> {
  await platformRequest('business/heard-about', { body: { answer } });
}
