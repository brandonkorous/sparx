import { OG_SIZE, renderSimpleOg } from '@/lib/og-simple';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Business OS Bootcamp — build your business, launch on sparx';

export default function Image() {
  return renderSimpleOg({
    tag: 'Bootcamp',
    accent: '#6366F1',
    title: 'Build your business',
    subtitle: 'Bootcamps led by certified sparx partners. Graduate when you publish.',
    footerRight: 'sparx.works/bootcamp',
  });
}
