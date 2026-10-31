// Server-only. Imports next/headers; never import it from a client component.

export { getSession, readSession, requireSession, type SparxSession } from './session';
export { fetchApiToken, type ApiToken } from './api-token';
export { authProxyHandlers, proxyAuthRequest, proxiedPath } from './proxy';
export {
  accountOperationHandlers,
  accountOperationPath,
  callAccountOperation,
  consumeHandoff,
  expiredSessionCookiesIn,
  forwardAccountOperation,
  mintHandoff,
  signOutSession,
  type ConsumeHandoffResult,
  type SessionCookie,
} from './platform-calls';
export {
  brandAuthUrl,
  forwardedHeaders,
  platformApiUrl,
  PlatformAuthUnavailableError,
} from './platform-api';
