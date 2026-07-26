// `@sparx/email/silica` — the React-free silica email render path (docs/120).
// Kept off the package root so a backend (email-worker / api-rest) can render a
// silica email without pulling React-Email into its bundle.

export {
  renderSilicaEmail,
  type RenderSilicaEmailInput,
  type RenderSilicaEmailOptions,
} from './render-silica-email';
export {
  composeSendDocument,
  buildEmailFrame,
  type EmailCompliance,
  type ComposeOptions,
  type FooterLink,
} from './frame';
// Re-exported so the frame's consumers (the email studio's canvas via the server, the
// send path) type the chrome without a direct @wizeworks/silicaui-builder dependency.
export type { EmailFrame } from '@wizeworks/silicaui-builder/email';
export { applyBrandColors, emailBrandColorDefaults } from './brand-colors';
// The role→hex map shape silica's `resolveEmailColorDefaults` produces; re-exported so
// the studio types its canvas colour map without a direct silicaui-builder dep.
export type { EmailColorDefaults } from '@wizeworks/silicaui-builder/email';
export { emailDocumentToText } from './to-text';
