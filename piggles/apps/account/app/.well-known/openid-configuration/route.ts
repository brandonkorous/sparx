import { NextResponse, type NextRequest } from 'next/server';
import { mcpDiscoveryDocument, OAUTH_DISCOVERY_HEADERS } from '@/lib/mcp-oauth-metadata';

// OpenID Provider Metadata alias (docs/07 §5).
//
// Some MCP clients probe /.well-known/openid-configuration instead of
// /.well-known/oauth-authorization-server. Serving the same document from both
// means discovery succeeds either way — which client a customer happens to use
// is not something they should have to know.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const metadata = await mcpDiscoveryDocument('openid', request);
  return NextResponse.json(metadata, { headers: OAUTH_DISCOVERY_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_DISCOVERY_HEADERS });
}
