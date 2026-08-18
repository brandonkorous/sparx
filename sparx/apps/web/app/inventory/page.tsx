import { makeMetadata } from '@/lib/load-module';
import { InventoryPage } from '@/components/marketing/inventory-page';

export const generateMetadata = makeMetadata('inventory');

export default function Inventory() {
  return <InventoryPage />;
}
