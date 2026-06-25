import { DetailPageShell } from '../../../_components/detail-page-shell';
import { CollectionDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="collection" entityId={id}>
      <CollectionDetailContent id={id} />
    </DetailPageShell>
  );
}
