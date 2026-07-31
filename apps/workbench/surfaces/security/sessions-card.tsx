'use client';

// The devices signed in to this account right now — and the power to sign any
// of them out.
//
// One card per device rather than a table: each row is three facts about ONE
// thing (what it is, where from, when last seen) plus a single action, and a
// table would invent columns to justify itself and put two long user-agent
// strings side by side in a pane that is routinely half a screen wide.
//
// The device making THIS request is marked and cannot sign itself out here —
// that is what the chrome's Sign out is for, and offering it in this list would
// be a button that closes the page you are on. Everything else can be ended,
// each behind a confirm that names it, because signing out the wrong device is a
// small nuisance you would rather not hand out by accident.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  EmptyState,
  Text,
  Timestamp,
  Tooltip,
  useToast,
} from '@wizeworks/silicaui-react';
import { authClient } from '@sparx/auth/client';
import { LogOut, MonitorSmartphone, ShieldOff } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { FormSection } from '../../components/form-section';
import {
  describeDevice,
  useRevokeOtherSessions,
  useRevokeSession,
  type AuthSession,
} from './security-data';

function ms(iso: string): number {
  return new Date(iso).getTime();
}

interface SessionsCardProps {
  /** The device list, lifted to the surface so the pane toolbar's Refresh can
   *  reload it alongside the activity record. */
  sessions: AuthSession[] | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

export function SessionsCard({ sessions, isPending, isError, refetch }: SessionsCardProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const session = authClient.useSession();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  // Better Auth's session object carries the token of the CURRENT session, which
  // is how a row is matched to "the device you are on right now".
  const currentToken = (session.data?.session as { token?: string } | undefined)?.token ?? null;

  const rows = sessions ?? [];
  const otherCount = rows.filter((row) => row.token !== currentToken).length;

  const signOut = async (row: AuthSession) => {
    const device = describeDevice(row.userAgent);
    const ok = await confirm({
      title: `Sign out ${device}?`,
      description: `That device will have to sign in again with your email and password to reach this account. ${
        row.ipAddress ? `It was last seen from ${row.ipAddress}. ` : ''
      }Nothing it has already done is undone.`,
      confirmLabel: 'Sign it out',
      cancelLabel: 'Leave it signed in',
      color: 'danger',
    });
    if (!ok) return;
    revoke.mutate(row.token, {
      onSuccess: () => {
        toast.add({ title: `${device} has been signed out`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not sign that device out',
          description: error instanceof Error ? error.message : 'Nothing was changed.',
          type: 'error',
        });
      },
    });
  };

  const signOutOthers = async () => {
    const ok = await confirm({
      title: 'Sign out every other device?',
      description: `This signs out all ${String(otherCount)} other ${
        otherCount === 1 ? 'device' : 'devices'
      } signed in to your account. The device you are using now stays signed in. Anyone on another device will have to sign in again.`,
      confirmLabel: 'Sign the others out',
      cancelLabel: 'Leave them signed in',
      color: 'danger',
    });
    if (!ok) return;
    revokeOthers.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: 'Your other devices have been signed out', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not sign the other devices out',
          description: error instanceof Error ? error.message : 'Nothing was changed.',
          type: 'error',
        });
      },
    });
  };

  return (
    <FormSection
      title="Devices signed in"
      description="Every device currently signed in to your account. If you see one you do not recognise, sign it out and change your password."
      action={
        otherCount > 0 ? (
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            className="shrink-0 whitespace-nowrap"
            loading={revokeOthers.isPending}
            onClick={() => {
              void signOutOthers();
            }}
          >
            <ShieldOff className="size-4" aria-hidden />
            Sign out all others
          </Button>
        ) : null
      }
    >
      {isError ? (
        <Alert color="error" variant="soft">
          <AlertContent>
            <AlertTitle>Could not load your devices</AlertTitle>
            <AlertDescription>
              This is a problem reaching the sign-in service. Your devices are unaffected.
            </AlertDescription>
          </AlertContent>
          <AlertActions>
            <Button
              size="sm"
              color="error"
              variant="soft"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          </AlertActions>
        </Alert>
      ) : isPending ? (
        <p className="text-sm" role="status">
          Loading your devices…
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MonitorSmartphone className="size-6" aria-hidden />}
          title="No signed-in devices"
          description="Nothing is signed in to your account right now."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const isCurrent = row.token === currentToken;
            const device = describeDevice(row.userAgent);
            return (
              <li
                key={row.token}
                className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3"
              >
                <MonitorSmartphone className="size-5 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{device}</span>
                    {isCurrent ? (
                      <Badge color="success" variant="soft" size="sm">
                        This device
                      </Badge>
                    ) : null}
                  </div>
                  <Text className="text-sm">
                    {row.ipAddress ? `From ${row.ipAddress} · ` : ''}
                    Active <Timestamp value={ms(row.updatedAt)} format="relative" /> · Signed in{' '}
                    <Timestamp value={ms(row.createdAt)} format="relative" />
                  </Text>
                </div>
                {isCurrent ? null : (
                  <Tooltip content="Sign this device out">
                    <Button
                      size="sm"
                      variant="ghost"
                      color="danger"
                      shape="square"
                      className="shrink-0"
                      disabled={revoke.isPending || revokeOthers.isPending}
                      aria-label={`Sign out ${device}`}
                      onClick={() => {
                        void signOut(row);
                      }}
                    >
                      <LogOut className="size-4" aria-hidden />
                    </Button>
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </FormSection>
  );
}
