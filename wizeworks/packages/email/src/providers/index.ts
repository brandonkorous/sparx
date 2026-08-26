import type { EmailProvider } from '../types';
import { consoleProvider } from './console';
import { createMailgunProvider } from './mailgun';
import { createPostalProvider } from './postal';

// Picks the active provider from SPARX_EMAIL_PROVIDER (defaults to console).
// Production runs on Mailgun:
//   SPARX_EMAIL_PROVIDER=mailgun
//   SPARX_MAILGUN_API_KEY=<account API key>
//   SPARX_MAILGUN_DOMAIN=<default sending domain>
//   SPARX_MAILGUN_DOMAINS=<every verified domain, comma-separated>
//   SPARX_MAILGUN_REGION=us                     (us|eu, default us)
//
// SPARX_MAILGUN_DOMAINS is what lets a second platform brand send from its own
// address: a message is posted to the domain its `From` names, so the DKIM
// signature aligns. A brand whose domain is missing from this list still sends,
// through the default — misaligned, exactly as before.
// Dev + CI stay on the console provider so tests can assert on the last
// send out of memory without hitting the network.
//
// The Postal provider is retained for the smoke-test / fallback path during
// the Mailgun cutover; it's not the production default anymore. See
// project_email_architecture memory for the rationale.

export {
  consoleProvider,
  lastConsoleSend,
  resetConsoleProvider,
  type ConsoleSend,
} from './console';
export {
  createMailgunProvider,
  MailgunParameterError,
  senderDomainOf,
  type MailgunConfig,
} from './mailgun';
export { createPostalProvider, PostalParameterError, type PostalConfig } from './postal';

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const choice = (process.env.SPARX_EMAIL_PROVIDER ?? 'console').toLowerCase();

  if (choice === 'mailgun') {
    const apiKey = process.env.SPARX_MAILGUN_API_KEY;
    const defaultDomain = process.env.SPARX_MAILGUN_DOMAIN;
    if (!apiKey || !defaultDomain) {
      throw new Error(
        'SPARX_EMAIL_PROVIDER=mailgun requires SPARX_MAILGUN_API_KEY and SPARX_MAILGUN_DOMAIN.'
      );
    }
    const region = (process.env.SPARX_MAILGUN_REGION ?? 'us').toLowerCase();
    if (region !== 'us' && region !== 'eu') {
      throw new Error(`SPARX_MAILGUN_REGION must be 'us' or 'eu', got '${region}'.`);
    }
    const domains = (process.env.SPARX_MAILGUN_DOMAINS ?? '')
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d !== '');
    cached = createMailgunProvider({ apiKey, defaultDomain, domains, region });
    return cached;
  }

  if (choice === 'postal') {
    const baseUrl = process.env.SPARX_POSTAL_URL;
    const apiKey = process.env.SPARX_POSTAL_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error(
        'SPARX_EMAIL_PROVIDER=postal requires SPARX_POSTAL_URL and SPARX_POSTAL_API_KEY.'
      );
    }
    cached = createPostalProvider({ baseUrl, apiKey });
    return cached;
  }

  cached = consoleProvider;
  return cached;
}

/** Test seam — swap the provider in unit/integration tests. */
export function _setEmailProvider(provider: EmailProvider | null): void {
  cached = provider;
}
