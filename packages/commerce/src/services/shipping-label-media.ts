// Uploads a purchased shipping-label PDF into the tenant's media library
// via @sparx/media's document path (PDF-capable, unlike the image-only
// MCP surface). Thin resolver: ShippingLabel bytes in, MediaAsset id out.

import { createDocumentAssetFromBytes } from '@sparx/media';
import { prisma } from '@sparx/db';

import type { ServiceContext } from '../errors';

const LABEL_MIME_BY_FORMAT: Record<'pdf' | 'png' | 'zpl', string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  // ZPL is raw thermal-printer markup, not a browser-renderable format —
  // store it as a PDF placeholder is wrong, so this format isn't uploaded
  // today (providers are asked for PDF; see provider-shippo's buyLabel).
  zpl: 'application/pdf',
};

export async function uploadShippingLabel(
  ctx: ServiceContext,
  input: { base64: string; format: 'pdf' | 'png' | 'zpl'; refId: string }
): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { slug: true },
  });
  if (!tenant) throw new Error(`Tenant ${ctx.tenantId} not found.`);

  const doc = await createDocumentAssetFromBytes(
    { tenantId: ctx.tenantId, actorId: ctx.userId ?? null, tenantSlug: tenant.slug },
    {
      data: Buffer.from(input.base64, 'base64'),
      mimeType: LABEL_MIME_BY_FORMAT[input.format],
      filename: `shipping-label-${input.refId}.${input.format === 'zpl' ? 'pdf' : input.format}`,
    }
  );
  return doc.assetId;
}
