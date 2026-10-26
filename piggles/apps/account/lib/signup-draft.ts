import {
  clearDraft,
  draftFlag,
  draftText,
  readDraft,
  saveDraft,
  type Draft,
  type DraftStore,
} from './form-draft';

// The signup form's draft: name, email and the consent box. Never the password.

export const SIGNUP_DRAFT = 'signup';

export interface SignupDraft {
  name: string;
  email: string;
  analytics: boolean;
}

const text = (value: FormDataEntryValue | null): string => (typeof value === 'string' ? value : '');

/** What the form keeps, picked by name so the password is never read. */
export function signupDraftFrom(form: FormData): Draft {
  return {
    name: text(form.get('name')),
    email: text(form.get('email')),
    analytics: form.get('analytics') === 'on',
  };
}

export function keepSignupDraft(form: FormData, store?: DraftStore | null): void {
  saveDraft(SIGNUP_DRAFT, signupDraftFrom(form), store);
}

/** The kept answers after a reload, or null when nothing was typed in this tab. */
export function restoreSignupDraft(store?: DraftStore | null): SignupDraft | null {
  const draft = readDraft(SIGNUP_DRAFT, store);
  if (!draft) return null;
  return {
    name: draftText(draft, 'name') ?? '',
    email: draftText(draft, 'email') ?? '',
    analytics: draftFlag(draft, 'analytics') ?? false,
  };
}

export function clearSignupDraft(store?: DraftStore | null): void {
  clearDraft(SIGNUP_DRAFT, store);
}
