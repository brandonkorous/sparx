import { NextResponse } from 'next/server';
import { mcpDiscoveryDocument, OAUTH_DISCOVERY_HEADERS } from '../../../lib/mcp-oauth-metadata';

// OpenID Provider Metadata alias (docs/07 §5). Some MCP clients probe
// /.well-known/openid-configuration instead of oauth-authorization-server;
// serve the same document so discovery succeeds either way.
export const dynamic = 'force-dynamic';

export async function GET() {
  const metadata = await mcpDiscoveryDocument('openid');
  return NextResponse.json(metadata, { headers: OAUTH_DISCOVERY_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_DISCOVERY_HEADERS });
}
