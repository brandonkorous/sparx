'use client';

// The four cards of the form-settings pane. Split out under RULE #0.5 — the pane
// itself owns loading, dirty state and saving; this owns the words.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import type { FormConfig } from './form-settings-data';

export interface FieldsProps {
  config: FormConfig;
  recipientsText: string;
  /** The first address that is not one, or null. Shown inline so she knows which line. */
  badAddress: string | null;
  pageSlug: string | null;
  onChange: (patch: Partial<FormConfig>) => void;
  onRecipientsChange: (text: string) => void;
}

export function NameCard({
  config,
  pageSlug,
  onChange,
}: Pick<FieldsProps, 'config' | 'pageSlug' | 'onChange'>) {
  return (
    <FormSection
      title="What this form is called"
      description="Only you see this. It is how the form is labelled in Form replies, so you can tell one from another at a glance."
    >
      <Field>
        <FieldLabel>Name</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={config.name}
              maxLength={120}
              placeholder={pageSlug ? `The form on /${pageSlug}` : 'Contact form'}
              onChange={(event) => {
                onChange({ name: event.target.value });
              }}
            />
          }
        />
        <FieldDescription>
          Leave this empty and replies are labelled with the page the form sits on.
        </FieldDescription>
      </Field>
    </FormSection>
  );
}

export function NotifyCard({
  config,
  recipientsText,
  badAddress,
  onChange,
  onRecipientsChange,
}: Omit<FieldsProps, 'pageSlug'>) {
  return (
    <FormSection
      title="Who hears about a message"
      description="Every message is kept in Form replies whether or not anyone is emailed, so nothing is ever lost by turning this off."
    >
      <Field>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={config.notify}
              onCheckedChange={(checked: boolean) => {
                onChange({ notify: checked });
              }}
            />
          }
        />
        <FieldLabel>Email me when somebody fills this in</FieldLabel>
      </Field>

      {config.notify ? (
        <Field>
          <FieldLabel>Send it to</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={3}
                value={recipientsText}
                placeholder="you@yourbusiness.com"
                onChange={(event) => {
                  onRecipientsChange(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            One address per line, up to twenty. Leave it empty and messages go to the address on
            your account.
          </FieldDescription>
        </Field>
      ) : null}

      {badAddress !== null ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>That does not look like an email address</AlertTitle>
            <AlertDescription>
              “{badAddress}” cannot be saved. Check it for a typo, then try again.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}
    </FormSection>
  );
}

export function ReplyCard({ config, onChange }: Pick<FieldsProps, 'config' | 'onChange'>) {
  return (
    <FormSection
      title="What they hear back"
      description="A short reply sent straight away, so somebody who writes to you at midnight knows it arrived."
    >
      <Field>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={config.autoresponder}
              onCheckedChange={(checked: boolean) => {
                onChange({ autoresponder: checked });
              }}
            />
          }
        />
        <FieldLabel>Send them a confirmation</FieldLabel>
      </Field>

      {config.autoresponder ? (
        <>
          <Field>
            <FieldLabel>Subject</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  value={config.autoresponderSubject}
                  maxLength={255}
                  placeholder="Thanks for getting in touch"
                  onChange={(event) => {
                    onChange({ autoresponderSubject: event.target.value });
                  }}
                />
              }
            />
          </Field>
          <Field>
            <FieldLabel>Message</FieldLabel>
            <FieldControl
              render={
                <Textarea
                  color="module"
                  rows={5}
                  value={config.autoresponderMessage}
                  maxLength={4000}
                  placeholder="Thanks for writing. I read every message myself and will get back to you within a day or two."
                  onChange={(event) => {
                    onChange({ autoresponderMessage: event.target.value });
                  }}
                />
              }
            />
            <FieldDescription>
              Write it in your own voice. It is the first thing they hear from you.
            </FieldDescription>
          </Field>
        </>
      ) : null}
    </FormSection>
  );
}

export function CustomersCard({ config, onChange }: Pick<FieldsProps, 'config' | 'onChange'>) {
  return (
    <FormSection
      title="Keep track of who wrote in"
      description="Needs the Customers app. With it off these do nothing, and a message still reaches Form replies."
    >
      <Field>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={config.addToCrm}
              onCheckedChange={(checked: boolean) => {
                // A sale needs somebody to attach to, so turning the contact off
                // turns the sale off with it.
                onChange({ addToCrm: checked, ...(checked ? {} : { openDeal: false }) });
              }}
            />
          }
        />
        <FieldLabel>Add them to my customers</FieldLabel>
      </Field>
      <Field>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={config.openDeal}
              onCheckedChange={(checked: boolean) => {
                onChange({ openDeal: checked, ...(checked ? { addToCrm: true } : {}) });
              }}
            />
          }
        />
        <FieldLabel>Start a sale I can follow up</FieldLabel>
      </Field>
    </FormSection>
  );
}
