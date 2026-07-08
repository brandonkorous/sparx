import { TaxZoneDetailContent } from './_content';

export const dynamic = 'force-dynamic';

export default async function TaxZoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <TaxZoneDetailContent id={id} />
      </div>
    </div>
  );
}
