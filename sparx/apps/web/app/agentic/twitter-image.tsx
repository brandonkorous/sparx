// Twitter cards share the OG renderer. Config is declared locally because
// Next.js can't statically detect re-exported route config.
import Image from './opengraph-image';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'sparx Agentic — point your own AI at your live business data over MCP.';

export default Image;
