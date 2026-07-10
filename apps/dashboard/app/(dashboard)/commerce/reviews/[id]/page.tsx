import { DetailPageShell } from '../../../_components/detail-page-shell';
import { ReviewDetailContent } from './_content';

export const dynamic = 'force-dynamic';

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="review" entityId={id}>
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <ReviewDetailContent id={id} />
        </div>
      </div>
    </DetailPageShell>
  );
}
