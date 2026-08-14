import { OG_SIZE, renderOg } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'How Piggles keeps your business data safe, separate and yours';

export default function Image() {
  return renderOg({
    title: 'The boring things, done properly.',
    subtitle: 'How your information is kept, who can reach it, and how you get it back.',
  });
}
