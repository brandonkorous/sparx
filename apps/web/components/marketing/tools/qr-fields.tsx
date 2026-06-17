'use client';

import { Input, Textarea, NativeSelect, Switch } from '@sparx/ui';
import { Field } from './ui-kit';
import type { QrType, QrFields } from './lib/qr';

/** The per-content-type input set for the QR generator. */
export function QrFieldSet({
  type,
  fields,
  set,
}: {
  type: QrType;
  fields: QrFields;
  set: (key: string, value: string) => void;
}) {
  const val = (k: string) => fields[k] ?? '';

  switch (type) {
    case 'url':
      return (
        <Field label="Website URL" htmlFor="qr-url">
          <Input
            id="qr-url"
            type="url"
            inputMode="url"
            placeholder="https://example.com"
            value={val('url')}
            onChange={(e) => set('url', e.target.value)}
          />
        </Field>
      );
    case 'text':
      return (
        <Field label="Text" htmlFor="qr-text">
          <Textarea
            id="qr-text"
            rows={4}
            placeholder="Any text to encode"
            value={val('text')}
            onChange={(e) => set('text', e.target.value)}
          />
        </Field>
      );
    case 'tel':
      return (
        <Field label="Phone number" htmlFor="qr-tel">
          <Input
            id="qr-tel"
            type="tel"
            placeholder="+1 555 123 4567"
            value={val('tel')}
            onChange={(e) => set('tel', e.target.value)}
          />
        </Field>
      );
    case 'sms':
      return (
        <>
          <Field label="Phone number" htmlFor="qr-sms-tel">
            <Input
              id="qr-sms-tel"
              type="tel"
              placeholder="+1 555 123 4567"
              value={val('tel')}
              onChange={(e) => set('tel', e.target.value)}
            />
          </Field>
          <Field label="Message" htmlFor="qr-sms-msg">
            <Textarea
              id="qr-sms-msg"
              rows={2}
              value={val('message')}
              onChange={(e) => set('message', e.target.value)}
            />
          </Field>
        </>
      );
    case 'email':
      return (
        <>
          <Field label="Email address" htmlFor="qr-email">
            <Input
              id="qr-email"
              type="email"
              placeholder="hello@example.com"
              value={val('email')}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Subject" htmlFor="qr-email-subj">
              <Input
                id="qr-email-subj"
                value={val('subject')}
                onChange={(e) => set('subject', e.target.value)}
              />
            </Field>
            <Field label="Body" htmlFor="qr-email-body">
              <Input
                id="qr-email-body"
                value={val('body')}
                onChange={(e) => set('body', e.target.value)}
              />
            </Field>
          </div>
        </>
      );
    case 'wifi':
      return (
        <>
          <Field label="Network name (SSID)" htmlFor="qr-ssid">
            <Input id="qr-ssid" value={val('ssid')} onChange={(e) => set('ssid', e.target.value)} />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Password" htmlFor="qr-wifi-pw">
              <Input
                id="qr-wifi-pw"
                value={val('password')}
                onChange={(e) => set('password', e.target.value)}
              />
            </Field>
            <Field label="Encryption" htmlFor="qr-wifi-enc">
              <NativeSelect
                id="qr-wifi-enc"
                value={val('encryption') || 'WPA'}
                onChange={(e) => set('encryption', e.target.value)}
              >
                <option value="WPA">WPA / WPA2 / WPA3</option>
                <option value="WEP">WEP</option>
                <option value="nopass">No password</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label="Hidden network">
            <Switch
              checked={val('hidden') === 'true'}
              onCheckedChange={(c) => set('hidden', c ? 'true' : 'false')}
            />
          </Field>
        </>
      );
    case 'vcard':
      return (
        <>
          <div className="tool-fieldgrid">
            <Field label="First name" htmlFor="qr-fn">
              <Input
                id="qr-fn"
                value={val('firstName')}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="qr-ln">
              <Input
                id="qr-ln"
                value={val('lastName')}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Company" htmlFor="qr-org">
              <Input id="qr-org" value={val('org')} onChange={(e) => set('org', e.target.value)} />
            </Field>
            <Field label="Title" htmlFor="qr-title">
              <Input
                id="qr-title"
                value={val('title')}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Phone" htmlFor="qr-phone">
              <Input
                id="qr-phone"
                type="tel"
                value={val('phone')}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="qr-vc-email">
              <Input
                id="qr-vc-email"
                type="email"
                value={val('email')}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Website" htmlFor="qr-vc-url">
            <Input
              id="qr-vc-url"
              type="url"
              value={val('url')}
              onChange={(e) => set('url', e.target.value)}
            />
          </Field>
        </>
      );
  }
}
