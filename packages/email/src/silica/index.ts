// `@sparx/email/silica` — the React-free silica email render path (docs/120).
// Kept off the package root so a backend (email-worker / api-rest) can render a
// silica email without pulling React-Email into its bundle.

export {
  renderSilicaEmail,
  type RenderSilicaEmailInput,
  type RenderSilicaEmailOptions,
} from './render-silica-email';
export { composeSendDocument, type EmailCompliance, type ComposeOptions } from './frame';
export { applyBrandColors } from './brand-colors';
export { emailDocumentToText } from './to-text';
