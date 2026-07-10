import { DetailPageShell } from '../../../_components/detail-page-shell';
import { ConfiguratorTemplateDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConfiguratorTemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="configurator-template" entityId={id}>
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <ConfiguratorTemplateDetailContent id={id} />
        </div>
      </div>
    </DetailPageShell>
  );
}
