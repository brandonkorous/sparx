import { OG_SIZE, renderSimpleOg } from '@/lib/og-simple';
import { bootcampDates, bootcampLocation, FORMAT_LABEL, fetchBootcamp } from '@/lib/bootcamp';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'sparx Business OS Bootcamp';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await fetchBootcamp(slug);
  if (!b) {
    return renderSimpleOg({
      tag: 'Bootcamp',
      accent: '#6366F1',
      title: 'Business OS Bootcamp',
      footerRight: 'sparx.works/bootcamp',
    });
  }
  return renderSimpleOg({
    tag: 'Bootcamp',
    accent: '#6366F1',
    title: b.title,
    subtitle: `${FORMAT_LABEL[b.format]} · ${bootcampDates(b)} · ${bootcampLocation(b)}`,
    footerLeft: `Hosted by ${b.host.displayName}`,
    footerRight: 'sparx.works/bootcamp',
  });
}
