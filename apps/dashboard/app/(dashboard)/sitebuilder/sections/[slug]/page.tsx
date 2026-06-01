import { notFound } from 'next/navigation';
import { getDefinition } from '../../_lib/api';
import { SectionStudio } from '../../_components/section-studio';

// Edit an existing custom section type by slug (404 → notFound).
export default async function EditSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const definition = await getDefinition(slug).catch(() => null);
  if (!definition) notFound();
  return <SectionStudio mode="edit" definition={definition} />;
}
