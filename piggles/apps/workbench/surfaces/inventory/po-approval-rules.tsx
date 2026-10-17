'use client';

// SPENDING LIMITS: when an order needs a second pair of eyes. The mirror of the
// limits on the way IN; these hold YOUR order until somebody senior agrees to spend.

// Sorted by threshold, descending, which is the order the rules are APPLIED in: the
// strictest threshold an order clears wins, so a $20,000 order routes to the $10,000
// approver, not the $500 one. Any other sort would show a false precedence.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  Text,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faCirclePlus, faShieldCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents } from './data';
import {
  approverLabel,
  ruleScopeLabel,
  usePoApprovalRules,
  type PoApprovalRule,
} from './po-approvals-data';

const DETAIL_KEY = 'inventory.purchase-orders.approval-rules.detail';

type Rules = ReturnType<typeof usePoApprovalRules>;
type OpenRule = (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function RuleRow({ row, onOpen }: { row: PoApprovalRule; onOpen: OpenRule }) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(row.id, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(row.id, event);
      }}
    >
      <td className="w-full max-w-0 min-w-56">
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{row.name}</span>
          <span className="truncate text-sm">{ruleScopeLabel(row)}</span>
        </span>
      </td>
      <td
        data-label={row.minAmountCents === 0 ? undefined : 'Holds from'}
        className="text-right whitespace-nowrap tabular-nums"
      >
        {row.minAmountCents === 0 ? 'Every order' : formatCents(row.minAmountCents)}
      </td>
      <td data-label="Signed off by" className="hidden whitespace-nowrap @lg:table-cell">
        {approverLabel(row)}
      </td>
      <td className="whitespace-nowrap">
        <Badge color={row.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
          {row.isActive ? 'In force' : 'Switched off'}
        </Badge>
      </td>
    </tr>
  );
}

function RulesTable({ rows, onOpen }: { rows: PoApprovalRule[]; onOpen: OpenRule }) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Limit</th>
          <th className="text-right whitespace-nowrap">Holds from</th>
          <th className="hidden whitespace-nowrap @lg:table-cell">Signed off by</th>
          <th className="whitespace-nowrap">State</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <RuleRow key={row.id} row={row} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}

function RulesBody({
  ctx,
  rules,
  onOpen,
}: {
  ctx: SurfaceContext;
  rules: Rules;
  onOpen: OpenRule;
}) {
  const rows = rules.data?.items ?? [];
  if (rules.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faShieldCheck} className="size-6" aria-hidden />}
        title="Could not load your spending limits"
        description="This is a problem reaching the server, not a statement that you have none. Try again in a moment."
        error={rules.error}
      />
    );
  }
  if (rules.isLoading) {
    return <PaneWaiting label="Loading your spending limits…" />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faShieldCheck} className="size-6" aria-hidden />}
        title="No spending limits set"
        description="Every order to a supplier goes straight to them the moment somebody sends it. Set a limit and orders of that much or more wait for a named person to approve them first: the usual reason is a business where more than one person can buy."
        actions={
          <Button
            color="module"
            onClick={() => {
              ctx.open(DETAIL_KEY, { id: 'new' });
            }}
          >
            <Icon glyph={faCirclePlus} className="size-4" aria-hidden />
            Set a limit
          </Button>
        }
      />
    );
  }

  return <RulesTable rows={rows} onOpen={onOpen} />;
}

// The sentence NAMES another screen, so it offers to open it: telling somebody
// where their held order went and leaving them to find it is half an answer.
function SignOffsNote({ ctx }: { ctx: SurfaceContext }) {
  return (
    <Text className="text-sm">
      Orders waiting on a limit appear under{' '}
      <Button
        variant="link"
        size="sm"
        className="px-0 align-baseline text-sm"
        onClick={() => {
          ctx.open('inventory.purchase-orders.approvals', {}, { target: 'tab' });
        }}
      >
        Sign-offs
      </Button>
      . Nothing is ordered while an order waits.
    </Text>
  );
}

function RulesToolbar({ ctx, rules }: { ctx: SurfaceContext; rules: Rules }) {
  return (
    <PaneToolbar
      label="Spending limits controls"
      primary={
        <Button
          className="ml-auto"
          size="sm"
          color="module"
          onClick={() => {
            ctx.open(DETAIL_KEY, { id: 'new' });
          }}
        >
          <Icon glyph={faCirclePlus} className="size-4" aria-hidden />
          New limit
        </Button>
      }
      refresh={
        <RefreshButton
          isFetching={rules.isFetching}
          updatedAt={rules.data ? rules.dataUpdatedAt : undefined}
          onRefresh={() => {
            void rules.refetch();
          }}
        />
      }
    />
  );
}

export function PoApprovalRulesSurface({ ctx }: { ctx: SurfaceContext }) {
  const rules = usePoApprovalRules(true);
  const rows = rules.data?.items ?? [];

  const open: OpenRule = (id, event) => {
    ctx.open(DETAIL_KEY, { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <RulesToolbar ctx={ctx} rules={rules} />

      {rows.length > 1 ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>When two limits both apply</AlertTitle>
            <AlertDescription>
              The strictest one the order clears wins, so an order that reaches your highest limit
              goes to that approver rather than to the person named on a smaller one. The list is in
              that order, top first.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <Card className="min-h-0 flex-1 overflow-auto">
        <RulesBody ctx={ctx} rules={rules} onOpen={open} />
      </Card>

      <SignOffsNote ctx={ctx} />
    </div>
  );
}
