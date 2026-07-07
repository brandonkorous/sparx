// The "Sell on sparx.market" call-to-action band that closes the home page (and is
// reusable on other discovery surfaces). Solid surface, no gradient.

import Link from 'next/link';
import { Store } from 'lucide-react';
import { Button } from 'silicaui-react';

export function SellCta() {
  return (
    <section className="border-base-300 bg-base-200 flex flex-col items-start justify-between gap-6 rounded-2xl border p-8 md:flex-row md:items-center md:p-12">
      <div>
        <h2 className="text-base-content text-2xl font-bold tracking-[-0.01em]">
          Sell on sparx.market
        </h2>
        <p className="text-base-content/70 mt-2 max-w-xl">
          Already running a store on sparx? List your products on the marketplace in a click and
          reach shoppers across the whole network — sparx handles payment and payout.
        </p>
      </div>
      <Button render={<Link href="/sell" />} color="primary" variant="solid" size="lg">
        <Store size={18} aria-hidden />
        Start selling
      </Button>
    </section>
  );
}
