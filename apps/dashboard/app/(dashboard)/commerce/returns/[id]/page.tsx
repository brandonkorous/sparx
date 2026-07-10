import { DetailPageShell } from '../../../_components/detail-page-shell';
import { ReturnDetailContent } from './_content';

export const dynamic = 'force-dynamic';

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="return" entityId={id}>
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <ReturnDetailContent id={id} />
        </div>
      </div>
    </DetailPageShell>
  );
}
