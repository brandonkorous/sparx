import { DetailPageShell } from '../../../_components/detail-page-shell';
import { ProductDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="product" entityId={id}>
      <ProductDetailContent id={id} />
    </DetailPageShell>
  );
}
