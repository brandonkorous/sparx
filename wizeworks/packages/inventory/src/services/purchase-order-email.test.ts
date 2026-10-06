import { describe, expect, it } from 'vitest';

import { purchaseOrderEmailRefusal } from './purchase-order-email';

// Only an order the business has actually PLACED may reach the supplier. A
// draft or an order still waiting for sign-off would have them ship goods
// nobody agreed to buy (sparx persona issue 071).
describe('which orders may be emailed to the supplier', () => {
  const refusal = (status: string) => purchaseOrderEmailRefusal({ number: 'PO-000001', status });

  it('refuses a draft, an order waiting for sign-off and a canceled one, and says which', () => {
    expect(refusal('draft')).toContain('still a draft');
    expect(refusal('pending_approval')).toContain('waiting for sign-off');
    expect(refusal('cancelled')).toContain('was canceled');
  });

  it('sends a placed order, and a copy of one already received or closed', () => {
    expect(refusal('submitted')).toBeNull();
    expect(refusal('partial')).toBeNull();
    expect(refusal('received')).toBeNull();
    expect(refusal('closed')).toBeNull();
  });
});
