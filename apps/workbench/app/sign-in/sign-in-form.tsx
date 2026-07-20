'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@sparx/auth/client';
import {
  Alert,
  Button,
  Card,
  Field,
  FieldControl,
  FieldLabel,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { Wordmark } from '@sparx/brand/react';

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await signIn.email({ email, password });

    if (result.error) {
      // Deliberately vague: distinguishing "no such account" from "wrong
      // password" tells an attacker which emails are registered.
      setError('That email and password combination did not work. Please try again.');
      setPending(false);
      return;
    }

    router.replace('/');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <Wordmark className="h-6 self-start" />
          <Heading level={1} className="mt-3 text-xl">
            Sign in to your workbench
          </Heading>
          <Text className="text-base-content/70 text-sm">
            Use the same email and password as your sparx dashboard.
          </Text>
        </div>

        {error ? (
          <Alert color="danger" variant="soft">
            {error}
          </Alert>
        ) : null}

        <Field>
          <FieldLabel>Email</FieldLabel>
          <FieldControl
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </Field>

        <Field>
          <FieldLabel>Password</FieldLabel>
          <FieldControl
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
        </Field>

        <Button type="submit" color="primary" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Card>
  );
}
