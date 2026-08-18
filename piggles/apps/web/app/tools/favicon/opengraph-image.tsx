import { OG_SIZE, toolOgAlt, toolOgImage } from '@/components/marketing/tools/tool-og';

const SLUG = 'favicon';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = toolOgAlt(SLUG);

export default function Image() {
  return toolOgImage(SLUG);
}
