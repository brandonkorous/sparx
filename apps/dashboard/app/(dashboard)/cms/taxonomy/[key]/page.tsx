import { TaxonomyDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageParams {
  params: Promise<{ key: string }>;
}

export default async function TaxonomyDetailPage({ params }: PageParams) {
  const { key } = await params;
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <TaxonomyDetailContent id={key} />
      </div>
    </div>
  );
}
