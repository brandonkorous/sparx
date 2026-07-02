import { OG_SIZE, renderSimpleOg } from '@/lib/og-simple';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'sparx Partner Program — build your practice on sparx';

export default function Image() {
  return renderSimpleOg({
    tag: 'Partner Program',
    accent: '#6366F1',
    title: 'Build your practice on sparx',
    subtitle: 'Refer clients, host bootcamps, and earn every time one goes live.',
    footerRight: 'sparx.works/partners',
  });
}
