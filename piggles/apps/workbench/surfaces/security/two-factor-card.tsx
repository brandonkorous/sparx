'use client';

// Two-step verification — the authenticator-app second factor (docs/16 §2.4).
//
// This is the one card on the Security pane that changes how the operator gets
// INTO their business, so it is built to make the dangerous states impossible
// rather than merely discouraged:
//
//   • Setup is a three-step walk (prove who you are → save the codes → prove the
//     app works) and only the LAST step arms anything. A mis-scanned QR or a
//     phone that never got set up fails harmlessly at step three; there is no
//     path where the account is protected by a secret the operator does not
//     actually hold.
//   • The backup codes are shown between scanning and verifying, not after, so
//     the one screen that can ever display them frictionlessly is one the
//     operator has to walk through — not a dismissible afterthought at the end.
//   • Turning it OFF is a confirm, because it silently weakens the account and
//     is exactly what an attacker on a borrowed session would try.
//
// It lives INLINE in the pane, like the password card, so the whole "how I sign
// in" story is one column and mid-setup state registers as unsaved work.

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  faCopy,
  faDownload,
  faMobile,
  faShieldCheck,
  faShieldSlash,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import QRCode from 'qrcode';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useConfirm } from '../../lib/confirm';
import { FormSection } from '../../components/form-section';
import {
  useDisableTwoFactor,
  useEnableTwoFactor,
  useHasPassword,
  useRegenerateBackupCodes,
  useVerifyTwoFactor,
  type TwoFactorSetup,
} from './security-data';
import { productCopy, productCopyWith } from '../../lib/product';

/** Server: totpOptions.digits. */
const CODE_LENGTH = 6;

/** Where the card is in the setup walk. `off`/`on` are the resting states; the
 *  three between them exist only while someone is turning it on. */
type Step = 'off' | 'password' | 'scan' | 'verify' | 'on';

/** Render the setup URI as a QR image. Returns null until it resolves (and on
 *  failure) — the manual-entry secret below it is always available, so a missing
 *  image degrades to "type this in" rather than a dead end. */
function useQrDataUrl(totpURI: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!totpURI) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(totpURI, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [totpURI]);
  return dataUrl;
}

/** The shared secret out of an `otpauth://` URI, in the 4-character groups every
 *  authenticator app's manual-entry field expects. */
function manualKey(totpURI: string): string | null {
  const secret = new URL(totpURI.replace(/^otpauth:\/\//, 'https://')).searchParams.get('secret');
  if (!secret) return null;
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/** The backup codes, shown once. Deliberately a plain, copyable, downloadable
 *  block: the operator's job here is to get these OUT of the browser and
 *  somewhere they will still exist when their phone does not. */
function BackupCodes({ codes }: { codes: string[] }) {
  const toast = useToast();
  if (codes.length === 0) return null;

  const asText = codes.join('\n');

  return (
    <div className="border-base-300 flex flex-col gap-3 rounded border p-3">
      <Text className="text-sm font-medium">Your backup codes</Text>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(asText).then(
              () => {
                toast.add({ title: 'Backup codes copied', type: 'success' });
              },
              () => {
                toast.add({
                  title: 'Could not copy',
                  description: 'Select the codes and copy them by hand.',
                  type: 'error',
                });
              }
            );
          }}
        >
          <Icon glyph={faCopy} className="size-4" aria-hidden />
          Copy
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const blob = new Blob(
              [
                productCopyWith('security.backupCodes.file', `sparx backup codes\n\n${asText}\n`, {
                  codes: asText,
                }),
              ],
              {
                type: 'text/plain',
              }
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'sparx-backup-codes.txt';
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Icon glyph={faDownload} className="size-4" aria-hidden />
          Download
        </Button>
      </div>
      <Text className="text-sm">
        Each code signs you in once if you lose your phone. Keep them somewhere other than the phone
        itself — printed, or in a password manager. We cannot show them to you again without your
        password.
      </Text>
    </div>
  );
}

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const hasPassword = useHasPassword();

  const enable = useEnableTwoFactor();
  const verify = useVerifyTwoFactor();
  const disable = useDisableTwoFactor();
  const regenerate = useRegenerateBackupCodes();

  const [step, setStep] = useState<Step>(enabled ? 'on' : 'off');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  // Codes minted by "Create new backup codes" on an already-protected account —
  // the same one-time display, reached from the resting state.
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qr = useQrDataUrl(setup?.totpURI ?? null);

  // The server flips the flag mid-flow; follow it so the card can never claim
  // "off" for an account that is actually protected (or the reverse).
  useEffect(() => {
    setStep((prev) => {
      if (enabled && prev !== 'on') return 'on';
      if (!enabled && prev === 'on') return 'off';
      return prev;
    });
  }, [enabled]);

  // Abandoning mid-setup leaves an unverified enrollment behind and, worse,
  // backup codes the operator may not have saved. Worth a prompt.
  useDirtySource(
    step === 'scan' || step === 'verify',
    'You are part-way through setting up two-step verification and your backup codes are on screen. Leave anyway?'
  );

  const needsPassword = hasPassword.data === true;
  const busy = enable.isPending || verify.isPending || disable.isPending || regenerate.isPending;

  function reset() {
    setStep(enabled ? 'on' : 'off');
    setPassword('');
    setCode('');
    setSetup(null);
    setError(null);
  }

  function startSetup() {
    setError(null);
    if (needsPassword && password === '') {
      setError('Enter your password to continue.');
      return;
    }
    enable.mutate(password, {
      onSuccess: (result) => {
        setSetup(result);
        setPassword('');
        setStep('scan');
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Could not start setup. Please try again.');
      },
    });
  }

  function finishSetup() {
    setError(null);
    verify.mutate(code, {
      onSuccess: () => {
        setSetup(null);
        setCode('');
        setStep('on');
        toast.add({
          title: 'Two-step verification is on',
          description: 'From now on, signing in also asks for a code from your app.',
          type: 'success',
        });
      },
      onError: (err) => {
        setCode('');
        setError(err instanceof Error ? err.message : 'That code did not work.');
      },
    });
  }

  async function turnOff() {
    setError(null);
    const ok = await confirm({
      title: 'Turn off two-step verification?',
      description:
        'Your account goes back to being protected by your password alone, and your backup codes stop working. You can turn it back on later, but you will have to set your app up again from scratch.',
      confirmLabel: 'Turn it off',
      cancelLabel: 'Keep it on',
      color: 'danger',
    });
    if (!ok) return;
    if (needsPassword && password === '') {
      setError('Enter your password to turn two-step verification off.');
      return;
    }
    disable.mutate(password, {
      onSuccess: () => {
        setPassword('');
        setFreshCodes(null);
        setStep('off');
        toast.add({
          title: 'Two-step verification is off',
          description: 'Signing in now only asks for your password.',
          type: 'success',
        });
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Could not turn it off.');
      },
    });
  }

  function newBackupCodes() {
    setError(null);
    if (needsPassword && password === '') {
      setError('Enter your password to create new backup codes.');
      return;
    }
    regenerate.mutate(password, {
      onSuccess: (codes) => {
        setPassword('');
        setFreshCodes(codes);
        toast.add({
          title: 'New backup codes created',
          description: 'Your previous codes no longer work. Save these ones.',
          type: 'success',
        });
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Could not create new codes.');
      },
    });
  }

  /** The password prompt shared by every action that needs it. Rendered only for
   *  accounts that HAVE a password — a Google or passkey operator has nothing to
   *  type, and the server does not ask them for it either. */
  const passwordField = needsPassword ? (
    <Field>
      <FieldLabel>Your password</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>
        Confirms it is really you making this change, not someone on a screen you left open.
      </FieldDescription>
    </Field>
  ) : null;

  const errorAlert = error ? (
    <Alert color="danger" variant="soft" role="alert">
      {error}
    </Alert>
  ) : null;

  return (
    <FormSection
      title="Two-step verification"
      description="Ask for a code from your phone as well as your password, so knowing your password alone is not enough to sign in."
      action={
        <Badge color={enabled ? 'success' : 'neutral'} variant="soft">
          {enabled ? 'On' : 'Off'}
        </Badge>
      }
    >
      {/* ── Off, resting ─────────────────────────────────────────────────── */}
      {step === 'off' ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Icon glyph={faMobile} className="mt-0.5 size-5 shrink-0" aria-hidden />
            <Text className="text-sm">
              {productCopy(
                'security.twoFactor.needApp',
                'You will need a free authenticator app on your phone — Google Authenticator, Microsoft Authenticator, and 1Password all work. It shows a 6-digit code that changes every 30 seconds, and Piggles asks for that code when you sign in.'
              )}
            </Text>
          </div>
          <div className="flex justify-end">
            <Button
              color="module"
              size="sm"
              disabled={busy || hasPassword.isPending}
              onClick={() => {
                setError(null);
                setStep('password');
              }}
            >
              <Icon glyph={faShieldCheck} className="size-4" aria-hidden />
              Turn on two-step verification
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Step 1: prove who you are ────────────────────────────────────── */}
      {step === 'password' ? (
        <div className="flex flex-col gap-4">
          {errorAlert}
          {passwordField}
          {needsPassword ? null : (
            <Text className="text-sm">
              You sign in without a password, so there is nothing to confirm here — carry on to set
              up your app.
            </Text>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={busy} onClick={reset}>
              Cancel
            </Button>
            <Button
              color="module"
              size="sm"
              disabled={busy}
              loading={enable.isPending}
              onClick={startSetup}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Step 2: scan + save the codes ────────────────────────────────── */}
      {step === 'scan' && setup ? (
        <div className="flex flex-col gap-4">
          <Text className="text-sm">
            Open your authenticator app, add a new account, and scan this code. If you cannot scan,
            type the key underneath it in by hand.
          </Text>

          <div className="flex flex-wrap items-start gap-4">
            {qr ? (
              // A QR is an image of a secret, not decoration — it needs a real
              // white ground to stay scannable in either theme.
              <div className="rounded bg-white p-2">
                {/* A raw <img>, not next/image: a data: URI generated in the
                    browser a moment ago, so there is nothing for the image
                    optimizer to fetch, cache, or resize. */}
                <img
                  src={qr}
                  alt="QR code for setting up your authenticator app"
                  width={220}
                  height={220}
                />
              </div>
            ) : null}

            <div className="flex min-w-56 flex-1 flex-col gap-2">
              <Text className="text-sm font-medium">Or type this key in</Text>
              <code className="border-base-300 rounded border p-2 font-mono text-sm break-all">
                {manualKey(setup.totpURI) ?? setup.totpURI}
              </code>
            </div>
          </div>

          <BackupCodes codes={setup.backupCodes} />

          <Alert color="warning" variant="soft">
            Save your backup codes before you continue — this is the only time they are shown
            without your password.
          </Alert>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={busy} onClick={reset}>
              Cancel
            </Button>
            <Button
              color="module"
              size="sm"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep('verify');
              }}
            >
              I have saved them — continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Step 3: prove the app works ──────────────────────────────────── */}
      {step === 'verify' ? (
        <div className="flex flex-col gap-4">
          {errorAlert}
          <Text className="text-sm">
            {productCopy(
              'security.twoFactor.verifyStep',
              'Last step: enter the 6-digit code your app is showing for Piggles right now. Nothing is switched on until this works, so a code that will not verify costs you nothing.'
            )}
          </Text>

          <Field>
            <FieldLabel>Code from your app</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="text-center text-lg tracking-[0.4em]"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && code.length === CODE_LENGTH) finishSetup();
                  }}
                />
              }
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep('scan');
              }}
            >
              Back
            </Button>
            <Button
              color="module"
              size="sm"
              disabled={busy || code.length < CODE_LENGTH}
              loading={verify.isPending}
              onClick={finishSetup}
            >
              Turn it on
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── On, resting ──────────────────────────────────────────────────── */}
      {step === 'on' ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Icon
              glyph={faShieldCheck}
              className="text-success mt-0.5 size-5 shrink-0"
              aria-hidden
            />
            <Text className="text-sm">
              Signing in asks for a code from your authenticator app as well as your password. If
              you lose your phone, one of your backup codes gets you back in.
            </Text>
          </div>

          {errorAlert}
          {freshCodes ? <BackupCodes codes={freshCodes} /> : null}
          {passwordField}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              loading={regenerate.isPending}
              onClick={newBackupCodes}
            >
              Create new backup codes
            </Button>
            <Button
              size="sm"
              color="danger"
              variant="outline"
              disabled={busy}
              loading={disable.isPending}
              onClick={() => void turnOff()}
            >
              <Icon glyph={faShieldSlash} className="size-4" aria-hidden />
              Turn off
            </Button>
          </div>
        </div>
      ) : null}
    </FormSection>
  );
}
