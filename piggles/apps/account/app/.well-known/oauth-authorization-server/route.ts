import { NextResponse } from 'next/server';
import { mcpDiscoveryDocument, OAUTH_DISCOVERY_HEADERS } from '@/lib/mcp-oauth-metadata';

// RFC 8414 — OAuth 2.0 Authorization Server Metadata (docs/07 §5).
//
// Public and unauthenticated: an MCP client fetches this to discover the
// authorize / token / register endpoints after the resource server points it at
// this origin. Without it a Piggles tenant cannot connect an assistant at all —
// discovery is the first request in the flow, and it was 404ing.
export const dynamic = 'force-dynamic';

export async function GET() {
  const metadata = await mcpDiscoveryDocument('oauth');
  return NextResponse.json(metadata, { headers: OAUTH_DISCOVERY_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_DISCOVERY_HEADERS });
}
