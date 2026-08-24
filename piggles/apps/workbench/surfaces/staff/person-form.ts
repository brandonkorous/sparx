'use client';

// The identity form's own shape: what the fields hold, and the two conversions
// between that and the person the API knows about.

import type { MemberDraft, StaffMember } from './data';

export interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  employmentType: MemberDraft['employmentType'];
  status: MemberDraft['status'];
  startedOn: string;
  endedOn: string;
  externalPayrollId: string;
  notes: string;
  siteIds: string[];
  primarySiteId: string;
}

export const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  employmentType: 'employee',
  status: 'active',
  startedOn: '',
  endedOn: '',
  externalPayrollId: '',
  notes: '',
  siteIds: [],
  primarySiteId: '',
};

export function formFrom(person: StaffMember): FormState {
  return {
    firstName: person.firstName,
    lastName: person.lastName ?? '',
    email: person.email ?? '',
    phone: person.phone ?? '',
    jobTitle: person.jobTitle ?? '',
    employmentType: person.employmentType,
    status: person.status,
    startedOn: person.startedOn ? person.startedOn.slice(0, 10) : '',
    endedOn: person.endedOn ? person.endedOn.slice(0, 10) : '',
    externalPayrollId: person.externalPayrollId ?? '',
    notes: person.notes ?? '',
    siteIds: person.siteIds,
    primarySiteId: person.primarySiteId ?? '',
  };
}

export function toDraft(form: FormState): MemberDraft {
  const blank = (value: string) => (value.trim() === '' ? null : value.trim());
  return {
    firstName: form.firstName.trim(),
    lastName: blank(form.lastName),
    email: blank(form.email),
    phone: blank(form.phone),
    jobTitle: blank(form.jobTitle),
    employmentType: form.employmentType,
    status: form.status,
    startedOn: blank(form.startedOn),
    endedOn: blank(form.endedOn),
    externalPayrollId: blank(form.externalPayrollId),
    notes: blank(form.notes),
    siteIds: form.siteIds,
    primarySiteId: form.primarySiteId === '' ? null : form.primarySiteId,
  };
}
