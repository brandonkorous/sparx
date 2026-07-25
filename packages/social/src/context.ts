// The tenant/user context the social post + lifecycle services run under. Pure
// data (no Fastify) so it lives in the package and is shared by every transport
// (REST, MCP). api-rest builds one from a request in its own social-context lib.

export interface SocialContext {
  tenantId: string;
  userId: string;
}
