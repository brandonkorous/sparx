import { NextResponse, type NextRequest } from 'next/server';
import {
  authServerOrigin,
  buildAuthorizationServerMetadata,
  OAUTH_DISCOVERY_HEADERS,
} from '../../../lib/mcp-oauth-metadata';

// RFC 8414 — OAuth 2.0 Authorization Server Metadata (docs/07 §5). Public,
// unauthenticated: MCP clients fetch this to discover the authorize / token /
// register endpoints after the resource server (mcp.sparx.works) points them at
// this origin.
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const metadata = buildAuthorizationServerMetadata(authServerOrigin(request.nextUrl.origin));
  return NextResponse.json(metadata, { headers: OAUTH_DISCOVERY_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_DISCOVERY_HEADERS });
}
