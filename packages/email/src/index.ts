// @sparx/email — typed templates, render path, and provider.
//
// Two ways callers reach the email pipeline:
//
//   1. (Default) Publish 'email.send' to Pub/Sub. email-worker pulls the
//      event, calls renderTemplate(), and hands the result to the active
//      provider (Mailgun in prod, console in dev/test).
//
//   2. (Escape hatch) Call sendTemplate() directly. Only for OTP / 2FA
//      and other synchronous-required flows — see CLAUDE.md.

export type { SendableEmail, DeliveryResult, EmailProvider } from './types';

export {
  consoleProvider,
  lastConsoleSend,
  resetConsoleProvider,
  createMailgunProvider,
  MailgunParameterError,
  createPostalProvider,
  PostalParameterError,
  getEmailProvider,
  _setEmailProvider,
  type ConsoleSend,
} from './providers';

export {
  renderTemplate,
  renderAuthoredEmail,
  sendEmail,
  sendTemplate,
  _renderTemplateForTest,
  type TemplateId,
  type TemplateSend,
  type RenderTemplateOptions,
  type AuthoredEmailInput,
} from './send';

// Builder email node-tree render (docs/52): walk a BuilderNode tree → branded,
// table-based React Email. The successor to the retired section composer
// (docs/52 §8) — marketing emails are authored in the Builder.
export {
  renderEmailTree,
  composeEmailTree,
  type RenderEmailTreeInput,
  type RenderEmailTreeOptions,
} from './builder/render-email-tree';

export {
  PasswordResetEmail,
  WelcomeMerchantEmail,
  DomainRenewalReminderEmail,
  EmailLayout,
  type PasswordResetEmailProps,
  type WelcomeMerchantEmailProps,
  type DomainRenewalReminderEmailProps,
} from './templates';

// Component primitives + tokens — consumed by templates inside this package;
// also exported so apps building one-off email content (e.g. a CRM export
// summary screen embedded in a notification) can re-use the brand chrome.
export * from './components';

// Mailgun domain-admin control-plane (create / verify / delete sending
// domains). Consumed by @sparx/email-platform's domain-service.
export {
  getMailgunDomainAdmin,
  MailgunAdminError,
  type MailgunDomainAdmin,
  type MailgunDomainResult,
  type MailgunDnsRecord,
} from './admin/mailgun-domains';
