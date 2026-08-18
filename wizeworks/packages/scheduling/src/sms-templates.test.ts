import { describe, expect, it } from 'vitest';

import { renderBookingSms } from './sms-templates';

const fields = {
  serviceName: 'Oil change',
  whenLabel: 'Mon, Jun 22 at 2:30 PM',
  siteName: 'Ace Auto',
};

describe('renderBookingSms', () => {
  it('renders a distinct, field-bearing body for each notification type', () => {
    const types = ['confirmation', 'reminder', 'change', 'cancellation'] as const;
    const bodies = types.map((t) => renderBookingSms(t, fields));
    // Every body names the site, service, and time, and they are all distinct.
    for (const body of bodies) {
      expect(body).toContain('Ace Auto');
      expect(body).toContain('Oil change');
      expect(body).toContain('Mon, Jun 22 at 2:30 PM');
    }
    expect(new Set(bodies).size).toBe(types.length);
  });

  it('confirmation reads as a booked confirmation', () => {
    expect(renderBookingSms('confirmation', fields)).toMatch(/booked/i);
  });

  it('cancellation reads as a cancellation', () => {
    expect(renderBookingSms('cancellation', fields)).toMatch(/cancelled/i);
  });
});
