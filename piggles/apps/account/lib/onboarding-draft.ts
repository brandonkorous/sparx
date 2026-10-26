import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import {
  clearDraft,
  draftFlag,
  draftList,
  draftText,
  readDraft,
  saveDraft,
  type DraftStore,
} from './form-draft';

// The setup screen's draft: every answer, so a reload for a new release keeps them all.

export const ONBOARDING_DRAFT = 'onboarding';

export interface OnboardingDraft {
  name: string;
  trade: string;
  address: string;
  /** True once the address was typed by hand, so the name stops overwriting it. */
  ownAddress: boolean;
  look: string;
  picked: PigglesGroup[];
  heard: string;
}

const isGroup = (value: string): value is PigglesGroup =>
  (PIGGLES_GROUPS as readonly string[]).includes(value);

export function keepOnboardingDraft(answers: OnboardingDraft, store?: DraftStore | null): void {
  saveDraft(ONBOARDING_DRAFT, { ...answers }, store);
}

/** The kept answers, only those present and well formed, or null when none. */
export function restoreOnboardingDraft(store?: DraftStore | null): Partial<OnboardingDraft> | null {
  const d = readDraft(ONBOARDING_DRAFT, store);
  if (!d) return null;
  const picked = draftList(d, 'picked')?.filter(isGroup);
  const kept: Partial<OnboardingDraft> = {
    name: draftText(d, 'name'),
    trade: draftText(d, 'trade'),
    address: draftText(d, 'address'),
    ownAddress: draftFlag(d, 'ownAddress'),
    look: draftText(d, 'look'),
    picked,
    heard: draftText(d, 'heard'),
  };
  return Object.fromEntries(Object.entries(kept).filter(([, value]) => value !== undefined));
}

export function clearOnboardingDraft(store?: DraftStore | null): void {
  clearDraft(ONBOARDING_DRAFT, store);
}
