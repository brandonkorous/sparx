// `@wizeworks/email/silica` — the React-free silica email render path (docs/120).
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
export {
  applyBrandColors,
  emailBrandColorDefaults,
  emailBrandDarkColorDefaults,
} from './brand-colors';
// Dark-mode CSS generators — `buildDarkModeCss` is the `@media`-wrapped block the send
// injects; `darkModeRules` is the same rules UNGATED, for the studio's dark preview (an
// iframe can't be forced into a dark OS preference, so the toggle applies them directly).
export { buildDarkModeCss, darkModeRules } from './dark-mode';
// Removes `<img src="">` from a projected body — an empty src makes a mail client fetch
// the email itself and draw its broken-image icon. See `empty-images.ts`.
export { dropEmptyEmailImages } from './empty-images';
// The role→hex map shape silica's `resolveEmailColorDefaults` produces; re-exported so
// the studio types its canvas color map without a direct silicaui-builder dep.
export type { EmailColorDefaults } from '@wizeworks/silicaui-builder/email';
export { emailDocumentToText } from './to-text';
// Send-time link-click attribution (docs/impl transactional-email Slice 10): tags
// on-site links so the tenant's own analytics credit the email. The lint layer
// (`lintEmailRender`) reuses these to tell the author, in plain language, which
// links will be tracked and which are off-site.
export {
  tagEmailHtmlLinks,
  tagEmailTextLinks,
  tagTrackedUrl,
  EMAIL_UTM_MEDIUM,
  type EmailLinkTracking,
} from './link-tracking';
// Pre-send checks (Gmail-clipping size, dead links, missing image descriptions,
// misspelled personalization tags, subject/preview text) — the confidence layer under
// the studio's "Preview & Check". Runs server-side alongside `renderPreview`.
export {
  lintEmailRender,
  type EmailCheck,
  type EmailCheckLevel,
  type LintEmailInput,
} from './lint';
