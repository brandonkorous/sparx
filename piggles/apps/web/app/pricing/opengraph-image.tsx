import { OG_SIZE, renderOg } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Piggles pricing — $49 a month, all fifteen apps';

export default function Image() {
  return renderOg({
    title: '$49 a month. All fifteen apps.',
    subtitle: 'No tiers, no per-app unlocks, and no upgrade button in the way of your work.',
  });
}
