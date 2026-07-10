import { DetailPageShell } from '../../../_components/detail-page-shell';
import { WarehouseDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WarehouseDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="warehouse" entityId={id}>
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <WarehouseDetailContent id={id} />
        </div>
      </div>
    </DetailPageShell>
  );
}
