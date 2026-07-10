import { DetailPageShell } from '../../../_components/detail-page-shell';
import { MenuDetailContent } from '../menu-detail';

export const dynamic = 'force-dynamic';

interface PageParams {
  params: Promise<{ location: string }>;
}

export default async function EditNavigationMenuPage({ params }: PageParams) {
  const { location } = await params;
  return (
    <DetailPageShell typeId="menu" entityId={location}>
      <div className="flex flex-col gap-5">
        <MenuDetailContent id={location} />
      </div>
    </DetailPageShell>
  );
}
