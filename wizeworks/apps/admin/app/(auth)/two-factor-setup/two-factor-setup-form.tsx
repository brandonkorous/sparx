'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Stack, Text } from '@wizeworks/ui';
import {
  Alert,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import QRCode from 'qrcode';
import { signOut, twoFactor } from '@wizeworks/operator-auth/client';
import { AuthShell } from '../_components/auth-shell';

// Operator MFA enrollment — the screen an un-enrolled operator is pinned to.
//
// Three steps, and only the last one arms anything: confirm the password, scan
// the code and save the backup codes, then prove a generated code works. A
// mis-scan therefore fails at step three and costs nothing, which matters more
// here than for tenant staff — there is no self-serve recovery for an operator
// locked out of a cross-tenant console.

const CODE_LENGTH = 6;

type Step = 'password' | 'scan' | 'verify';

/** The shared secret out of an `otpauth://` URI, grouped for manual entry. */
function manualKey(totpURI: string): string {
  const secret = new URL(totpURI.replace(/^otpauth:\/\//, 'https://')).searchParams.get('secret');
  if (!secret) return totpURI;
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

export function TwoFactorSetupForm({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('password');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [totpURI, setTotpURI] = React.useState<string | null>(null);
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [qr, setQr] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!totpURI) return;
    let cancelled = false;
    void QRCode.toDataURL(totpURI, { margin: 1, width: 200, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        // The manual key below is always shown, so a failed render degrades to
        // "type it in" rather than a dead end.
      });
    return () => {
      cancelled = true;
    };
  }, [totpURI]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password === '') {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    const result = await twoFactor.enable({ password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? 'That password did not work.');
      return;
    }
    const data = result.data as { totpURI?: string; backupCodes?: string[] } | null;
    if (!data?.totpURI) {
      setError('Setup could not be started. Please try again.');
      return;
    }
    setTotpURI(data.totpURI);
    setBackupCodes(data.backupCodes ?? []);
    setPassword('');
    setStep('scan');
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await twoFactor.verifyTotp({ code });
    setBusy(false);
    if (result.error) {
      setCode('');
      setError('That code did not work. Codes change every 30 seconds — try the current one.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <AuthShell
      title="Set up two-step verification"
      subtitle={`Required for every operator account. Signed in as ${email}.`}
    >
      {step === 'password' ? (
        <form onSubmit={start} noValidate>
          <Stack gap={4}>
            <Text size="sm">
              The operator console reads across every tenant, so it is protected by a second factor
              as well as a password. You will need an authenticator app on your phone.
            </Text>
            <Field>
              <FieldLabel required>Confirm your password</FieldLabel>
              <FieldControl
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                render={<PasswordInput />}
              />
            </Field>
            {error ? (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            ) : null}
            <Button type="submit" disabled={busy} loading={busy}>
              Continue
            </Button>
            <Button type="button" variant="ghost" onClick={() => void signOut()}>
              Sign out instead
            </Button>
          </Stack>
        </form>
      ) : null}

      {step === 'scan' && totpURI ? (
        <Stack gap={4}>
          <Text size="sm">Scan this with your authenticator app, or type the key in by hand.</Text>
          {qr ? (
            // A QR is an image of a secret — it needs a real white ground to stay
            // scannable whatever theme the console is in.
            <div className="w-fit self-center rounded bg-white p-2">
              {/* A raw <img>, not next/image: a data: URI generated in the browser
                  a moment ago, so there is nothing to fetch, cache, or resize. */}
              <img
                src={qr}
                alt="QR code for setting up your authenticator app"
                width={200}
                height={200}
              />
            </div>
          ) : null}
          <code className="border-base-300 rounded border p-2 font-mono text-sm break-all">
            {manualKey(totpURI)}
          </code>

          {backupCodes.length > 0 ? (
            <Stack gap={2}>
              <Text size="sm" className="font-medium">
                Backup codes
              </Text>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
                {backupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <Alert color="warning" variant="soft">
                Save these now — each signs you in once if you lose your phone, and this is the only
                time they are shown without your password. There is no self-serve recovery for an
                operator account.
              </Alert>
            </Stack>
          ) : null}

          <Button type="button" onClick={() => setStep('verify')}>
            I have saved them — continue
          </Button>
        </Stack>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={finish} noValidate>
          <Stack gap={4}>
            <Text size="sm">
              Enter the 6-digit code your app is showing now. Nothing is switched on until this
              works.
            </Text>
            <Field>
              <FieldLabel required>Code from your app</FieldLabel>
              <FieldControl
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="text-center text-lg tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              />
            </Field>
            {error ? (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            ) : null}
            <Button type="submit" disabled={busy || code.length < CODE_LENGTH} loading={busy}>
              Turn it on
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('scan')}>
              Back
            </Button>
          </Stack>
        </form>
      ) : null}
    </AuthShell>
  );
}
