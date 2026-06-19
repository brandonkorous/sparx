import { ContentEntryDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ typeKey: string; id: string }>;
}

// Full-page route for a content-type entry. The editing UI lives in `_content.tsx`
// so it can also mount inside the dashboard shell's detail panel (drawer / modal).
// `_content` owns its own chrome per surface: with a live preview it fills the
// content area edge-to-edge (a builder); without one it falls back to the
// width-constrained, scrolling stacked editor. So the route adds no wrapper here.
export default async function EditEntryPage({ params }: PageProps) {
  const { id } = await params;
  return <ContentEntryDetailContent id={id} previewEnabled />;
}
