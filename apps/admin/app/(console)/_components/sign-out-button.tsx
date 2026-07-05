'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@sparx/ui';
import { signOut } from '@sparx/operator-auth/client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="soft"
      size="sm"
      onClick={async () => {
        await signOut();
        router.push('/sign-in');
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
