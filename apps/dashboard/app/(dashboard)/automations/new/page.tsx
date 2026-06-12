// Create an automation (docs/84 Slice G-UI). Full-bleed map + inspector editor,
// editor-gated (a viewer is bounced to the list rather than shown an editor that
// would 403 on submit). The editor offers only triggers/actions for the tenant's
// active modules.

import { redirect } from 'next/navigation';
import { listEnabledModules, requireSession } from '@sparx/auth';

import { AutomationEditor } from '../_components/automation-editor';
import '../automation-editor.css';

export const dynamic = 'force-dynamic';

export default async function NewAutomationPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (!(role === 'owner' || role === 'admin' || role === 'editor')) redirect('/automations');

  const enabledModules = await listEnabledModules(session.user.tenantId);

  return <AutomationEditor enabledModules={enabledModules} />;
}
