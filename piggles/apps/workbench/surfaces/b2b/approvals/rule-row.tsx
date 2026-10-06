'use client';

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  Badge,
  Button,
  NativeSelect,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { type ApprovalRule } from '../approvals-data';
import type { namableApprovers } from '../../../components/approver-choice';
import { signOffValue } from '../../../components/approver-choice';
import { accountApproversOption, ruleSignOffNote } from '../sign-off-words';
import { ApproverOptions } from './approver-options';

export function RuleRow({
  rule,
  people,
  onApprover,
  onOpenAccount,
  busy,
  onToggle,
  onDelete,
}: {
  rule: ApprovalRule;
  busy: boolean;
  people: ReturnType<typeof namableApprovers>;
  onApprover: (next: string) => void;
  onOpenAccount: (accountId: string) => void;
  onToggle: (next: boolean) => void;
  onDelete: () => void;
}) {
  const note = ruleSignOffNote(rule);
  return (
    // Two lines: what the limit IS and its controls on top, the who-signs select
    // under them at a capped width; the note below says it in full (sparx persona
    // issue 087).
    <li className="border-base-300 flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 break-words">
          <span className="block font-medium">Over {rule.minAmountFormatted}</span>
          <Text as="span" className="block text-sm">
            {rule.accountName ?? 'Every customer'}
          </Text>
        </span>
        <RuleRowControls rule={rule} busy={busy} onToggle={onToggle} onDelete={onDelete} />
      </div>
      <RuleSignerSelect rule={rule} people={people} busy={busy} onApprover={onApprover} />
      <RuleSignOffNote rule={rule} note={note} onOpenAccount={onOpenAccount} />
    </li>
  );
}

function RuleRowControls({
  rule,
  busy,
  onToggle,
  onDelete,
}: {
  rule: ApprovalRule;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* State on both sides of the switch: a rule that is holding orders
              says so as plainly as one that is not, and neither is gray. */}
      <Badge color={rule.isActive ? 'success' : 'warning'} variant="soft" size="sm">
        {rule.isActive ? 'On' : 'Off'}
      </Badge>
      <Switch
        color="module"
        checked={rule.isActive}
        disabled={busy}
        aria-label={`Turn this rule ${rule.isActive ? 'off' : 'on'}`}
        onCheckedChange={onToggle}
      />
      <Button
        size="sm"
        variant="ghost"
        color="danger"
        shape="square"
        disabled={busy}
        aria-label="Remove this rule"
        onClick={onDelete}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function RuleSignerSelect({
  rule,
  people,
  busy,
  onApprover,
}: {
  rule: ApprovalRule;
  people: ReturnType<typeof namableApprovers>;
  busy: boolean;
  onApprover: (next: string) => void;
}) {
  return (
    <NativeSelect
      color="module"
      size="sm"
      className="w-full max-w-md"
      value={signOffValue(rule)}
      disabled={busy}
      aria-label={`Who signs off orders over ${rule.minAmountFormatted}`}
      onChange={(event) => {
        onApprover(event.target.value);
      }}
    >
      <ApproverOptions
        people={people}
        accountOption={accountApproversOption(rule)}
        named={
          rule.requiredApproverUserId
            ? { userId: rule.requiredApproverUserId, name: rule.requiredApproverName }
            : null
        }
      />
    </NativeSelect>
  );
}

// Who actually signs, when it is the customer. With nobody there who can approve,
// your team signs, and the row says so with the way to change it.
function RuleSignOffNote({
  rule,
  note,
  onOpenAccount,
}: {
  rule: ApprovalRule;
  note: ReturnType<typeof ruleSignOffNote>;
  onOpenAccount: (accountId: string) => void;
}) {
  return note === null ? null : note.tone === 'warning' && rule.accountId ? (
    <Alert color="warning" variant="soft">
      <AlertContent>
        <AlertDescription>{note.text}</AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button
          size="sm"
          color="warning"
          onClick={() => {
            if (rule.accountId) onOpenAccount(rule.accountId);
          }}
        >
          Open the customer
        </Button>
      </AlertActions>
    </Alert>
  ) : (
    <p>{note.text}</p>
  );
}
