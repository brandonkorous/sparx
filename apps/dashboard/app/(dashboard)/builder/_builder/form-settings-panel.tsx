'use client';

// The form-settings panel — sparx's contribution to silica's Inspector (docs/115 on
// silica). silicaui ships the contact block and does the whole client half of a form
// (validation, FormData, busy/success/error), then stops at the host seam: it has no
// opinion about where a submission GOES. This panel is where the author says.
//
// It appears in the Design rail whenever a live form node is selected, and it writes
// straight to the server-only `FormDefinition` row keyed by that node's id. Nothing it
// collects is ever put in the tree — which is the whole point. On the legacy engine the
// recipient addresses were authored INTO the node's props and then surgically stripped
// at publish so they wouldn't be served to every visitor as spam bait. Here they never
// enter the tree at all, so there is nothing to strip and nothing to leak.
//
// A form with no saved row is not broken — it is a working form on its defaults
// (notify the account email). So this panel always opens on real values, and "Save" is
// the only thing that ever writes.

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FieldLabel,
  FieldStatus,
  Input,
  Textarea,
} from '@wizeworks/silicaui-react';
import type { InspectorPanel } from '@wizeworks/silicaui-builder/react';
import {
  DEFAULT_SILICA_FORM_CONFIG,
  isSilicaFormNode,
  type SilicaFormConfig,
  type SilicaNode,
} from '@sparx/builder-schemas';

import { getFormDefinition, saveFormDefinition } from '../_lib/form-actions';

interface FormSettingsProps {
  /** The selected form node's id — the key the routing row hangs off. */
  formNodeId: string;
  /** The slug of the page being edited, stored alongside for the inbox. */
  pageSlug: string | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** A labelled checkbox. silica's `Checkbox` is the bare native input (it takes no
 *  `label`), and this panel has five of them, so the label association lives here once
 *  rather than being re-hand-rolled per row. */
function CheckRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function FormSettings({ formNodeId, pageSlug }: FormSettingsProps) {
  const [config, setConfig] = useState<SilicaFormConfig>(DEFAULT_SILICA_FORM_CONFIG);
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load THIS form's saved routing. Keyed on the node id, so selecting a different
  // form on the same page swaps the panel's contents rather than showing stale values.
  useEffect(() => {
    let live = true;
    setLoading(true);
    void getFormDefinition(formNodeId).then((res) => {
      if (!live) return;
      if (res.ok && res.data) {
        setConfig(res.data.config);
        setRecipients(res.data.recipients.join(', '));
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [formNodeId]);

  const set = <K extends keyof SilicaFormConfig>(key: K, value: SilicaFormConfig[K]): void =>
    setConfig((c) => ({ ...c, [key]: value }));

  const save = useCallback(async () => {
    setState('saving');
    setError(null);
    const list = recipients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await saveFormDefinition(formNodeId, {
      pageSlug,
      recipients: list,
      config,
    });
    if (!res.ok) {
      setState('error');
      setError(res.error ?? 'Couldn’t save these settings.');
      return;
    }
    setState('saved');
  }, [formNodeId, pageSlug, recipients, config]);

  if (loading) {
    return <p className="text-base-content p-3 text-sm">Loading this form’s settings…</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <Field>
        <FieldLabel>Form name</FieldLabel>
        <Input
          value={config.name}
          placeholder="Contact form"
          onChange={(e) => set('name', e.target.value)}
        />
        <FieldStatus>Shown in your submissions inbox so you can tell forms apart.</FieldStatus>
      </Field>

      <Field>
        <FieldLabel>Thank-you message</FieldLabel>
        <Textarea
          rows={2}
          value={config.successMessage}
          onChange={(e) => set('successMessage', e.target.value)}
        />
        <FieldStatus>Replaces the form once someone sends it successfully.</FieldStatus>
      </Field>

      <CheckRow
        checked={config.notify}
        onChange={(on) => set('notify', on)}
        label="Email me when someone sends this form"
      />

      {config.notify && (
        <Field>
          <FieldLabel>Send those emails to</FieldLabel>
          <Input
            value={recipients}
            placeholder="you@yourbusiness.com, sales@yourbusiness.com"
            onChange={(e) => setRecipients(e.target.value)}
          />
          <FieldStatus>
            Separate addresses with commas. Leave this empty and we’ll email your account address.
          </FieldStatus>
        </Field>
      )}

      <CheckRow
        checked={config.addToCrm}
        // Opening a deal needs a contact to attach it to, so capturing the person is
        // not optional in that case. The server enforces this too — this just stops the
        // author from setting a combination it will silently override.
        disabled={config.openDeal}
        onChange={(on) => set('addToCrm', on)}
        label="Save the sender as a contact"
      />
      <CheckRow
        checked={config.openDeal}
        onChange={(on) => setConfig((c) => ({ ...c, openDeal: on, addToCrm: on || c.addToCrm }))}
        label="Also start a deal for them"
      />

      <CheckRow
        checked={config.autoresponder}
        onChange={(on) => set('autoresponder', on)}
        label="Send the sender a confirmation reply"
      />

      {config.autoresponder && (
        <>
          <Field>
            <FieldLabel>Reply subject</FieldLabel>
            <Input
              value={config.autoresponderSubject}
              onChange={(e) => set('autoresponderSubject', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Reply message</FieldLabel>
            <Textarea
              rows={3}
              value={config.autoresponderMessage}
              onChange={(e) => set('autoresponderMessage', e.target.value)}
            />
          </Field>
        </>
      )}

      {error && (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      )}
      {state === 'saved' && (
        <Alert color="success" variant="soft">
          Saved. Publish the site to put these changes live.
        </Alert>
      )}

      <Button color="primary" size="sm" onClick={() => void save()} disabled={state === 'saving'}>
        {state === 'saving' ? 'Saving…' : 'Save form settings'}
      </Button>
    </div>
  );
}

/** The panel factory the `BuilderHost` hands the engine. Returns the form panel only
 *  for a live form node (silica's `form` behavior + our `contact` action ref) — a
 *  decorative `<form>` an author stripped the action off gets nothing, matching what
 *  the submit endpoint would do with it.
 *
 *  `pageSlug` is a GETTER, not a value: the host is memoized once at mount, but the
 *  author switches pages inside the editor, and a form saved while looking at /contact
 *  must record /contact — not whichever page happened to be open when the studio
 *  mounted. (It is a label for the inbox, never an authorization input; the server
 *  finds the form by id across the page AND the frame.) */
export function makeFormPanels(
  pageSlug: () => string | null
): (node: SilicaNode) => InspectorPanel[] {
  return (node) => {
    const id = (node as { id?: string }).id;
    if (!id || !isSilicaFormNode(node)) return [];
    return [
      {
        id: 'sparx-form',
        title: 'Form settings',
        // Above silica's own style panels: where the submission GOES is the first
        // question an author has about a form, and how it looks is the second.
        order: -10,
        render: () => <FormSettings formNodeId={id} pageSlug={pageSlug()} />,
      },
    ];
  };
}
