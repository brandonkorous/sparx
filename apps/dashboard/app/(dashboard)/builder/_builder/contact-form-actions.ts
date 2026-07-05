'use server';

// Context the ContactForm inspector needs but can't get from the builder tree
// (docs/115): the owner's account email (to prefill the notify recipients — the
// endpoint falls back to it when the list is empty) and whether the CRM module is
// on (to decide if "Add them to my contacts" needs the turn-on-CRM prompt).
//
// Fetched once when a ContactForm node is selected. The activation itself reuses
// the real `setModuleEnabledAction('crm', true)` path — this action never flips a
// flag.

import 'server-only';
import { requireSession } from '@sparx/auth';

import { listModuleStateForCurrentTenant } from '../../settings/modules/actions';

export interface ContactFormInspectorContext {
  /** The signed-in owner's email — the default notify recipient. */
  ownerEmail: string;
  /** Whether the CRM module is active (drives the addToCrm prompt). */
  crmEnabled: boolean;
  /** Whether this user may turn CRM on (owner / admin only). */
  canActivateCrm: boolean;
}

export async function getContactFormInspectorContext(): Promise<ContactFormInspectorContext> {
  const session = await requireSession();
  const canActivateCrm = session.user.role === 'owner' || session.user.role === 'admin';
  let crmEnabled = false;
  try {
    const modules = await listModuleStateForCurrentTenant();
    crmEnabled = modules.find((m) => m.slug === 'crm')?.enabled ?? false;
  } catch {
    // If we can't read module state, assume off — the worst case is showing the
    // (dismissible) turn-on prompt to someone who already has CRM.
    crmEnabled = false;
  }
  return { ownerEmail: session.user.email ?? '', crmEnabled, canActivateCrm };
}
