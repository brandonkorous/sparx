import { OG_SIZE, renderOg } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'All fifteen Piggles apps';

export default function Image() {
  return renderOg({
    title: 'Fifteen apps. One subscription.',
    subtitle: 'Grouped the way a business works, not the way a software catalogue is filed.',
  });
}
