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
export {
  platformRequest,
  PlatformRequestError,
  setSessionCookies,
  type PlatformRequestInit,
} from './platform-request';
export {
  CONSENT_ERROR_PARAM,
  mcpDiscoveryDocument,
  readInvitation,
  readMcpConsentRequest,
  readSignInOptions,
  requestConfirmLink,
  submitMcpConsent,
  toSearchParams,
  type InvitationDetail,
  type McpConsentAnswer,
  type McpConsentRead,
  type McpConsentRequest,
  type SendLinkResult,
  type SignInOptions,
} from './platform-flows';
