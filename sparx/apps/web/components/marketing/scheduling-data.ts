/**
 * Scheduling marketing scenes — the page's industry-rotation fixtures.
 *
 * sparx Scheduling is industry-agnostic by construction (docs/79 §1, §12): a
 * salon, a restaurant, a fitness studio, a clinic, a tutor/consultant, AND a
 * fleet/auto shop all drive the SAME booking engine — they differ only in which
 * `bookingType` and capabilities they switch on. So every rotating surface on
 * the page (the hero booking card, the reminder timeline, the waitlist) cycles
 * through these scenes via <Cycle> instead of anchoring on one vertical (see
 * [[feedback-industry-agnostic-no-diesel]] + the rotation rule).
 *
 * These live here (not in the shared example-businesses.ts) because scheduling
 * scenes carry their own shape — a booked service, a resource, a slot time, a
 * policy, a reminder cadence — that no other module surface needs. Every entry
 * is the SAME shape so a rotating surface never reflows. Numbers are internally
 * coherent (deposit ≤ price; the policy matches a real §9.2 deposit type) and
 * grounded in docs/79 (booking types §5, policies §9.2, reminders §10). Fleet is
 * deliberately ONE scene of six, never the lens.
 */

export type SchedulingBookingType = 'appointment' | 'class' | 'reservation' | 'rental';

export interface SchedulingScene {
  /** short vertical label — for clarity + aria, rarely shown. */
  vertical: string;
  /** the business doing the booking. */
  business: string;
  /** which engine shape this scene exercises. */
  bookingType: SchedulingBookingType;
  /** booking reference shown on the card, e.g. 'BK-2048'. */
  ref: string;
  /** the service booked, e.g. 'Balayage + cut'. */
  service: string;
  /** the resource the slot allocates (staff / table / room / bay / instructor). */
  resource: string;
  /** the resource's role label, e.g. 'stylist', 'table', 'bay'. */
  resourceRole: string;
  /** the customer / party who booked. */
  customer: string;
  /** the slot day + time, in the customer's words. */
  slot: string;
  /** service duration, e.g. '2h 15m'. */
  duration: string;
  /** the booked service's price. */
  price: string;
  /** the §9.2 policy this service uses. */
  policy: 'free' | 'card hold' | 'deposit' | 'prepay';
  /** the deposit / hold / prepay amount taken at booking ('—' for free). */
  deposit: string;
  /** the reminder cadence configured on the policy (docs/79 §10). */
  reminders: string;
  /** a second capacity/roster fact that makes the booking type concrete. */
  capacityNote: string;
}

/**
 * Six verticals, one shape — appointment, class, reservation, rental, plus a
 * second appointment (consulting) and the B2B/fleet context. Deliberately
 * spread so no single industry reads as "what scheduling is for."
 */
export const SCHEDULING_SCENES: SchedulingScene[] = [
  {
    vertical: 'salon',
    business: 'Maple & Vine Studio',
    bookingType: 'appointment',
    ref: 'BK-2048',
    service: 'Balayage + cut',
    resource: 'Nora P.',
    resourceRole: 'stylist',
    customer: 'Dana Ruiz',
    slot: 'Thu, Jun 26 · 1:00 PM',
    duration: '2h 15m',
    price: '$185',
    policy: 'deposit',
    deposit: '$50 deposit',
    reminders: '24h + 2h · email + SMS',
    capacityNote: 'customer picked their stylist',
  },
  {
    vertical: 'fitness',
    business: 'North Loop Strength',
    bookingType: 'class',
    ref: 'BK-3310',
    service: 'Saturday HIIT',
    resource: 'Studio A',
    resourceRole: 'room',
    customer: 'Marcus Lee',
    slot: 'Sat, Jun 28 · 8:00 AM',
    duration: '45m',
    price: '$22 drop-in',
    policy: 'prepay',
    deposit: '$22 prepaid',
    reminders: '12h · email + SMS',
    capacityNote: '14 of 16 seats · waitlist on',
  },
  {
    vertical: 'restaurant',
    business: 'Hearth & Ember',
    bookingType: 'reservation',
    ref: 'BK-5521',
    service: 'Dinner · party of 4',
    resource: 'Table 12',
    resourceRole: 'table',
    customer: 'Priya Nair',
    slot: 'Fri, Jun 27 · 7:30 PM',
    duration: '1h 45m turn',
    price: 'no cover fee',
    policy: 'card hold',
    deposit: '$25/seat hold',
    reminders: '4h · SMS',
    capacityNote: 'seats 2–4 · matched to party',
  },
  {
    vertical: 'clinic',
    business: 'Riverside Therapy',
    bookingType: 'appointment',
    ref: 'BK-1184',
    service: 'Therapy session',
    resource: 'Dr. Owens',
    resourceRole: 'practitioner',
    customer: 'Sam Carter',
    slot: 'Mon, Jun 30 · 10:00 AM',
    duration: '50m',
    price: '$140',
    policy: 'card hold',
    deposit: 'card on file',
    reminders: '24h · email',
    capacityNote: 'weekly recurring series',
  },
  {
    vertical: 'rentals',
    business: 'Eastside Makerspace',
    bookingType: 'rental',
    ref: 'BK-7702',
    service: 'Laser-cutter bay',
    resource: 'Bay 3',
    resourceRole: 'equipment',
    customer: 'Reese Calderón',
    slot: 'Wed, Jun 25 · 2:00 PM',
    duration: '3h block',
    price: '$60',
    policy: 'prepay',
    deposit: '$60 prepaid',
    reminders: '24h + 1h · email + SMS',
    capacityNote: 'one renter per asset block',
  },
  {
    vertical: 'fleet service',
    business: 'Atlas Fleet Service',
    bookingType: 'appointment',
    ref: 'BK-9043',
    service: 'Scheduled fleet PM',
    resource: 'Bay 2 + Tech J.',
    resourceRole: 'bay + tech',
    customer: 'Reyes Fabrication',
    slot: 'Tue, Jul 1 · 7:00 AM',
    duration: '4h',
    price: 'billed to account',
    policy: 'free',
    deposit: '—',
    reminders: '48h + 24h · email',
    capacityNote: 'linked to account + vehicle',
  },
];
