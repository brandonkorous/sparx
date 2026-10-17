'use client';

// The devices signed in to this account, one card per device (three facts and one action; a table
// would invent columns in a half-width pane). THIS device is marked and cannot sign itself out here,
// since the chrome's Sign out does that; every other one can, behind a confirm that names it.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Text,
  Timestamp,
  Tooltip,
  useToast,
} from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneEmpty } from '../../components/pane-empty';

/** Registry module, so the brand draws one picture in the empty, waiting and failed states. */
const MODULE = 'platform';
import {
  faLaptopMobile,
  faRightFromBracket,
  faShieldSlash,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { FormSection } from '../../components/form-section';
import {
  describeDevice,
  useRevokeOtherSessions,
  useRevokeSession,
  type AuthSession,
} from './security-data';
import { whereFromPrefix, whereFromSentence } from './where-from-words';
import { failureMessage } from '../../lib/api/write-failure';

function ms(iso: string): number {
  return new Date(iso).getTime();
}

interface SessionsCardProps {
  /** Lifted to the surface so the toolbar's Refresh reloads it with the activity record. */
  sessions: AuthSession[] | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

interface Ui {
  toast: ReturnType<typeof useToast>;
  confirm: ReturnType<typeof useConfirm>;
}

function outcome(ui: Ui, done: string, failed: string) {
  return {
    onSuccess: () => {
      ui.toast.add({ title: done, type: 'success' });
    },
    onError: (error: unknown) => {
      const description = failureMessage(error, 'Nothing was changed.');
      ui.toast.add({ title: failed, description, type: 'error' });
    },
  };
}

async function signOutOne(row: AuthSession, ui: Ui, revoke: ReturnType<typeof useRevokeSession>) {
  const device = describeDevice(row.userAgent);
  const ok = await ui.confirm({
    title: `Sign out ${device}?`,
    description: `That device will have to sign in again with your email and password to reach this account. ${whereFromSentence(
      row.ipAddress
    )}Nothing it has already done is undone.`,
    confirmLabel: 'Sign it out',
    cancelLabel: 'Leave it signed in',
    color: 'danger',
  });
  if (!ok) return;
  revoke.mutate(
    row.token,
    outcome(ui, `${device} has been signed out`, 'Could not sign that device out')
  );
}

type RevokeOthers = ReturnType<typeof useRevokeOtherSessions>;

async function signOutAllOthers(otherCount: number, ui: Ui, revokeOthers: RevokeOthers) {
  const ok = await ui.confirm({
    title: 'Sign out every other device?',
    description: `This signs out all ${String(otherCount)} other ${
      otherCount === 1 ? 'device' : 'devices'
    } signed in to your account. The device you are using now stays signed in. Anyone on another device will have to sign in again.`,
    confirmLabel: 'Sign the others out',
    cancelLabel: 'Leave them signed in',
    color: 'danger',
  });
  if (!ok) return;
  revokeOthers.mutate(
    undefined,
    outcome(ui, 'Your other devices have been signed out', 'Could not sign the other devices out')
  );
}

function DevicesLoadError({ refetch }: { refetch: () => void }) {
  return (
    <Alert color="error">
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
  );
}

function SessionRow(props: {
  row: AuthSession;
  disabled: boolean;
  onSignOut: (row: AuthSession) => void;
}) {
  const { row } = props;
  const isCurrent = row.current;
  const device = describeDevice(row.userAgent);
  return (
    <li className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3">
      <Icon glyph={faLaptopMobile} className="size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 basis-48 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{device}</span>
          {isCurrent ? (
            <Badge color="success" variant="soft" size="sm">
              This device
            </Badge>
          ) : null}
        </div>
        <Text className="text-sm">
          {whereFromPrefix(row.ipAddress)}
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
            disabled={props.disabled}
            aria-label={`Sign out ${device}`}
            onClick={() => {
              props.onSignOut(row);
            }}
          >
            <Icon glyph={faRightFromBracket} className="size-4" aria-hidden />
          </Button>
        </Tooltip>
      )}
    </li>
  );
}

function SignOutOthersButton(props: { otherCount: number; ui: Ui; revokeOthers: RevokeOthers }) {
  return (
    <Button
      size="sm"
      variant="outline"
      color="neutral"
      className="shrink-0 whitespace-nowrap"
      loading={props.revokeOthers.isPending}
      onClick={() => {
        void signOutAllOthers(props.otherCount, props.ui, props.revokeOthers);
      }}
    >
      <Icon glyph={faShieldSlash} className="size-4" aria-hidden />
      Sign out all others
    </Button>
  );
}

export function SessionsCard({ sessions, isPending, isError, refetch }: SessionsCardProps) {
  const ui: Ui = { toast: useToast(), confirm: useConfirm() };
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  // "This device" is answered by the server on each row: the session cookie is httpOnly, and the
  // client-side check needed a call this origin does not serve, so this device counted as another.
  const rows = sessions ?? [];
  const otherCount = rows.filter((row) => !row.current).length;

  return (
    <FormSection
      title="Devices signed in"
      description="Every device currently signed in to your account. If you see one you do not recognize, sign it out and change your password."
      action={
        otherCount > 0 ? (
          <SignOutOthersButton otherCount={otherCount} ui={ui} revokeOthers={revokeOthers} />
        ) : null
      }
    >
      {isError ? (
        <DevicesLoadError refetch={refetch} />
      ) : isPending ? (
        <PaneWaiting module={MODULE} label="Loading your devices…" />
      ) : rows.length === 0 ? (
        /* No Card: the FormSection is one. <PaneEmpty> so this state draws the
           same kind of picture as the <PaneWaiting> beside it. */
        <PaneEmpty
          module={MODULE}
          icon={<Icon glyph={faLaptopMobile} className="size-6" aria-hidden />}
          title="No signed-in devices"
          description="Nothing is signed in to your account right now."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <SessionRow
              key={row.token}
              row={row}
              disabled={revoke.isPending || revokeOthers.isPending}
              onSignOut={(target) => {
                void signOutOne(target, ui, revoke);
              }}
            />
          ))}
        </ul>
      )}
    </FormSection>
  );
}
