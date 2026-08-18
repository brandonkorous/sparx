'use client';

// Change your password — a self-contained action inside the Security pane.
//
// It lives INLINE rather than behind a modal for one reason: it is already in a
// pane, and a modal here would be a second, weaker place to hold work with no
// dirty dot and no leave-guard. The three fields register as unsaved work while
// they hold anything, so closing the pane mid-change asks first.
//
// Explicit-save, like every editor: one button, and it stays disabled until the
// form is actually valid rather than accepting the change and bouncing it off
// the server. The one thing this cannot check — whether the CURRENT password is
// right — is left to the server, whose message is shown verbatim.

import { useState } from 'react';
import {
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { KeyRound } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { FormSection } from '../../components/form-section';
import { MIN_PASSWORD_LENGTH, useChangePassword } from './security-data';

const EMPTY = { current: '', next: '', confirm: '' };

export function PasswordCard() {
  const toast = useToast();
  const change = useChangePassword();

  const [fields, setFields] = useState(EMPTY);
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  // Held until blur so a field does not go red halfway through the first
  // character someone types into it.
  const [touched, setTouched] = useState({ current: false, next: false, confirm: false });

  const anyTyped = fields.current !== '' || fields.next !== '' || fields.confirm !== '';
  useDirtySource(
    anyTyped && !change.isPending,
    'You have started changing your password but not saved it. Close anyway?'
  );

  // Each rule is the plainest true sentence about the field it guards.
  const tooShort = fields.next !== '' && fields.next.length < MIN_PASSWORD_LENGTH;
  const sameAsOld = fields.next !== '' && fields.next === fields.current;
  const mismatch = fields.confirm !== '' && fields.confirm !== fields.next;

  const nextError =
    (touched.next || submitted) && tooShort
      ? `Use at least ${String(MIN_PASSWORD_LENGTH)} characters.`
      : (touched.next || submitted) && sameAsOld
        ? 'Choose a password different from your current one.'
        : null;
  const confirmError =
    (touched.confirm || submitted) && mismatch ? 'This does not match the new password.' : null;
  const currentError = submitted && fields.current === '' ? 'Enter your current password.' : null;

  const valid =
    fields.current !== '' &&
    fields.next.length >= MIN_PASSWORD_LENGTH &&
    !sameAsOld &&
    fields.confirm === fields.next;

  const set = (key: keyof typeof EMPTY) => (value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    change.mutate(
      {
        currentPassword: fields.current,
        newPassword: fields.next,
        revokeOtherSessions: signOutOthers,
      },
      {
        onSuccess: () => {
          setFields(EMPTY);
          setTouched({ current: false, next: false, confirm: false });
          setSubmitted(false);
          toast.add({
            title: 'Password changed',
            description: signOutOthers
              ? 'Your other signed-in devices have been signed out.'
              : 'Use your new password next time you sign in.',
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not change your password',
            // The server's sentence names the exact problem ("wrong current
            // password", "password too weak") far better than we can guess.
            description:
              error instanceof Error ? error.message : 'Check your current password and try again.',
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <FormSection
      title="Your password"
      description="Change the password you use to sign in. You will need your current one to set a new one."
    >
      <Field>
        <FieldLabel>Current password</FieldLabel>
        <FieldControl
          render={
            <Input
              color={currentError ? 'error' : 'module'}
              type="password"
              autoComplete="current-password"
              value={fields.current}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, current: true }));
              }}
              onChange={(event) => {
                set('current')(event.target.value);
              }}
            />
          }
        />
        {currentError ? <FieldStatus status="error">{currentError}</FieldStatus> : null}
      </Field>

      <Field>
        <FieldLabel>New password</FieldLabel>
        <FieldControl
          render={
            <Input
              color={nextError ? 'error' : 'module'}
              type="password"
              autoComplete="new-password"
              value={fields.next}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, next: true }));
              }}
              onChange={(event) => {
                set('next')(event.target.value);
              }}
            />
          }
        />
        {nextError ? (
          <FieldStatus status="error">{nextError}</FieldStatus>
        ) : (
          <FieldDescription>
            At least {MIN_PASSWORD_LENGTH} characters. A longer passphrase is harder to guess than a
            short one full of symbols.
          </FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel>Confirm new password</FieldLabel>
        <FieldControl
          render={
            <Input
              color={confirmError ? 'error' : 'module'}
              type="password"
              autoComplete="new-password"
              value={fields.confirm}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, confirm: true }));
              }}
              onChange={(event) => {
                set('confirm')(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
            />
          }
        />
        {confirmError ? <FieldStatus status="error">{confirmError}</FieldStatus> : null}
      </Field>

      <label className="flex items-start gap-2">
        <Checkbox
          color="module"
          checked={signOutOthers}
          aria-label="Sign out my other devices after changing my password"
          onChange={(event) => {
            setSignOutOthers(event.target.checked);
          }}
        />
        <Text as="span" className="text-sm">
          Sign out my other devices — the safe choice if you are changing this because you think
          someone else knows it.
        </Text>
      </label>

      <div className="flex justify-end">
        <Button color="module" size="sm" disabled={!anyTyped || change.isPending} onClick={submit}>
          <KeyRound className="size-4" aria-hidden />
          {change.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </div>
    </FormSection>
  );
}
