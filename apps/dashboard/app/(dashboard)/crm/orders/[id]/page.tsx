import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { OrderDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <Button
          variant="ghost"
          size="sm"
          iconStart={<ArrowLeft className="h-4 w-4" />}
          render={<Link href="/crm/orders" />}
        >
          All orders
        </Button>
        <OrderDetailContent id={id} />
      </div>
    </div>
  );
}
