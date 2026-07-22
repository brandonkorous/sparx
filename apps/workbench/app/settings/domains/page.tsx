import { redirectToSurface } from '../../../lib/surface-redirect';

// Legacy deep link from domain renewal-reminder emails (services/domain-worker):
// /settings/domains. The workbench manages domains via the
// `platform.settings.domains` surface, so translate to that `?open=` deep link.
export const dynamic = 'force-dynamic';

export default async function DomainsRedirect() {
  await redirectToSurface('platform.settings.domains');
}
