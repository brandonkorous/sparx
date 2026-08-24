'use client';

// WHO THEY ARE — the identity form, and which of the owner's businesses they
// work for.
//
// Their name is the field you type in, never also a read-only heading above the
// body. Lifecycle lives in the pane's toolbar.

import {
  Badge,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { productCopy } from '../../lib/product';
import type { FormState } from './person-form';

export type SetField = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

export function PersonIdentity({ form, set }: { form: FormState; set: SetField }) {
  return (
    <FormSection title="Who they are">
      <div className="grid gap-3 @lg:grid-cols-2">
        <Field>
          <FieldLabel>First name</FieldLabel>
          <FieldControl
            render={
              <Input
                value={form.firstName}
                onChange={(event) => {
                  set('firstName', event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Last name</FieldLabel>
          <FieldControl
            render={
              <Input
                value={form.lastName}
                onChange={(event) => {
                  set('lastName', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>Optional — plenty of people go by one name.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>What they do</FieldLabel>
          <FieldControl
            render={
              <Input
                placeholder="Lead technician, front counter, driver…"
                value={form.jobTitle}
                onChange={(event) => {
                  set('jobTitle', event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Working arrangement</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                value={form.employmentType}
                onChange={(event) => {
                  set('employmentType', event.target.value as FormState['employmentType']);
                }}
              >
                <option value="employee">Employee</option>
                <option value="contractor">Contractor</option>
                <option value="volunteer">Volunteer</option>
              </NativeSelect>
            }
          />
          <FieldDescription>
            {productCopy(
              'staff.employmentType.note',
              'This is for your own cost reporting. Piggles does not decide anyone’s employment status and never files anything based on it.'
            )}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Email</FieldLabel>
          <FieldControl
            render={
              <Input
                type="email"
                value={form.email}
                onChange={(event) => {
                  set('email', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>Where expiry reminders go.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Phone</FieldLabel>
          <FieldControl
            render={
              <Input
                value={form.phone}
                onChange={(event) => {
                  set('phone', event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Started</FieldLabel>
          <FieldControl
            render={
              <Input
                type="date"
                value={form.startedOn}
                onChange={(event) => {
                  set('startedOn', event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                value={form.status}
                onChange={(event) => {
                  set('status', event.target.value as FormState['status']);
                }}
              >
                <option value="active">Working</option>
                <option value="onboarding">Starting</option>
                <option value="suspended">Suspended</option>
                <option value="former">Left</option>
              </NativeSelect>
            }
          />
        </Field>
      </div>
    </FormSection>
  );
}

/**
 * Which of the owner's businesses this person works for.
 *
 * Only when there is more than one — a single-business owner has no choice to
 * make, and a checkbox with one option is a question that answers itself.
 *
 * The main one is where their cost lands when a shift names no business, so
 * unticking the current main has to hand that job to whoever is left rather
 * than leaving nobody holding it.
 */
export function PersonSites({
  form,
  setForm,
  sites,
}: {
  form: FormState;
  setForm: (update: (current: FormState) => FormState) => void;
  sites: { id: string; name: string }[];
}) {
  if (sites.length <= 1) return null;
  return (
    <FormSection
      title="Which business they work for"
      description="Their cost lands against the business whose job they worked. The main one is where it goes when a shift names none."
    >
      <div className="flex flex-col gap-2">
        {sites.map((site) => (
          <SiteRow key={site.id} site={site} form={form} setForm={setForm} />
        ))}
      </div>
    </FormSection>
  );
}

function SiteRow({
  site,
  form,
  setForm,
}: {
  site: { id: string; name: string };
  form: FormState;
  setForm: (update: (current: FormState) => FormState) => void;
}) {
  const checked = form.siteIds.includes(site.id);
  return (
    <div className="flex items-center gap-2 text-sm">
      <Checkbox
        id={`staff-site-${site.id}`}
        color="module"
        checked={checked}
        onChange={(event) => {
          const next = event.target.checked
            ? [...form.siteIds, site.id]
            : form.siteIds.filter((value) => value !== site.id);
          setForm((current) => ({
            ...current,
            siteIds: next,
            primarySiteId: next.includes(current.primarySiteId)
              ? current.primarySiteId
              : (next[0] ?? ''),
          }));
        }}
      />
      <label htmlFor={`staff-site-${site.id}`}>{site.name}</label>
      {checked && form.primarySiteId === site.id ? (
        <Badge color="module" variant="soft" size="sm">
          Main
        </Badge>
      ) : checked ? (
        <Button
          size="xs"
          variant="ghost"
          color="module"
          onClick={() => {
            setForm((current) => ({ ...current, primarySiteId: site.id }));
          }}
        >
          Make main
        </Button>
      ) : null}
    </div>
  );
}
