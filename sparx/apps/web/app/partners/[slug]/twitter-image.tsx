import { OG_SIZE } from '@/lib/og-simple';
import { renderPartnerOg } from './_og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'sparx partner';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderPartnerOg(slug);
}
