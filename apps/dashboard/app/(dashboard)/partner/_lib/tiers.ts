import type { PartnerTier } from '@sparx/partner-schemas';

// The partner tier ladder (docs/114 §B.1 tiers + §B.4 commission economics). One
// source of truth for the tier copy the Overview and Tier pages both render — the
// human label, the commission it earns, what it unlocks, and how a partner moves
// up. Rates are the snapshot economics: informal 20% first payment · registered
// 30% first payment · certified 30% first payment + 5% ongoing on managed accounts.

export interface TierMeta {
  tier: PartnerTier;
  label: string;
  /** One-line commission summary. */
  commission: string;
  /** The headline promise of this tier. */
  tagline: string;
  /** What this tier unlocks over the one below it. */
  unlocks: string[];
  /** How a partner reaches this tier. */
  howToReach: string;
  /** Whether reaching this tier is self-serve (informal) or reviewed. */
  reviewed: boolean;
}

export const TIER_ORDER: readonly PartnerTier[] = ['informal', 'registered', 'certified'] as const;

export const TIERS: Record<PartnerTier, TierMeta> = {
  informal: {
    tier: 'informal',
    label: 'Informal',
    commission: '20% of a referral’s first payment',
    tagline: 'Refer clients and earn — no commitment.',
    unlocks: [
      'A personal referral link',
      '20% commission on each referral’s first payment',
      'Access to the partner resources hub',
    ],
    howToReach: 'Instant — join the program and you’re in.',
    reviewed: false,
  },
  registered: {
    tier: 'registered',
    label: 'Registered',
    commission: '30% of a referral’s first payment',
    tagline: 'A listed practice with a higher rate.',
    unlocks: [
      'Everything in Informal',
      '30% commission on each referral’s first payment',
      'A public listing in the sparx.works partner directory',
      'Draft bootcamps to build your training program',
    ],
    howToReach: 'Apply for review — we confirm your practice within 3 business days.',
    reviewed: true,
  },
  certified: {
    tier: 'certified',
    label: 'Certified',
    commission: '30% first payment + 5% ongoing on managed accounts',
    tagline: 'The top tier — recurring revenue and published bootcamps.',
    unlocks: [
      'Everything in Registered',
      '5% ongoing commission on the accounts you manage',
      'Publish bootcamps publicly on sparx.works/bootcamp',
      'Priority placement in the partner directory',
    ],
    howToReach: 'Apply once you have a proven track record of successful client launches on sparx.',
    reviewed: true,
  },
};

/** The tier immediately above `tier`, or null when already Certified. */
export function nextTier(tier: PartnerTier): PartnerTier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1]! : null;
}
