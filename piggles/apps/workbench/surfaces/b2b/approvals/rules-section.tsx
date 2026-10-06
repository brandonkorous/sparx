'use client';

import { useMemo, useState } from 'react';
import { Button, Text } from '@wizeworks/silicaui-react';
import { faCheckCircle, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../../components/form-section';
import { PaneLoadError } from '../../../components/pane-load-error';
import { PaneWaiting } from '../../../components/pane-waiting';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { useApprovalRules, type ApprovalRule } from '../approvals-data';
import { namableApprovers } from '../../../components/approver-choice';
import { useTeamRoster } from '../../../lib/api/team';
import { MODULE } from './shared';
import { RuleRow } from './rule-row';
import { useRuleRowActions, useRemoveRule } from './rule-actions';
import { useRuleDraft } from './rule-draft';
import { AddRuleForm } from './add-rule-form';

export function RulesSection({ ctx }: { ctx: SurfaceContext }) {
  const rulesQuery = useApprovalRules();
  const [adding, setAdding] = useState(false);
  const draft = useRuleDraft(setAdding);

  // Only people already in the account can be named: an unanswered invitation has
  // no login, so it would hold every order with nobody able to release them.
  const roster = useTeamRoster();
  const people = useMemo(() => namableApprovers(roster.members), [roster.members]);

  const openAccount = (id: string) => {
    ctx.open('b2b.account.detail', { id }, { target: 'beside' });
  };

  return (
    <FormSection
      title="When sign-off is needed"
      description="Hold any order over a set amount until someone says yes: your team, or the customer's own approvers, on your site. Set it for every wholesale customer, or just one."
      action={
        !adding ? (
          <Button
            size="sm"
            variant="soft"
            color="module"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add a rule
          </Button>
        ) : null
      }
    >
      {adding ? <AddRuleForm draft={draft} people={people} setAdding={setAdding} /> : null}

      <RulesList
        rulesQuery={rulesQuery}
        adding={adding}
        people={people}
        openAccount={openAccount}
      />
    </FormSection>
  );
}

// The queue's house load-error and waiting wrappers, here too, so a failed rules
// list has a retry. [[feedback_a_fix_leaves_its_neighbour_behind]]
function RulesList({
  rulesQuery,
  adding,
  people,
  openAccount,
}: {
  rulesQuery: ReturnType<typeof useApprovalRules>;
  adding: boolean;
  people: ReturnType<typeof namableApprovers>;
  openAccount: (id: string) => void;
}) {
  const { removeRule, deleteRule } = useRemoveRule();
  const { updateRule, changeApprover, toggleRule } = useRuleRowActions();
  const rules = rulesQuery.data ?? [];

  return (
    <>
      {rulesQuery.isError ? (
        <PaneLoadError
          module={MODULE}
          icon={<Icon glyph={faCheckCircle} className="size-6" aria-hidden />}
          title="Could not load your limits"
          description="This is a problem reaching the server. Your limits are unaffected: they just could not be read just now."
          onRetry={() => {
            void rulesQuery.refetch();
          }}
        />
      ) : rulesQuery.isPending ? (
        <PaneWaiting module={MODULE} />
      ) : rules.length === 0 ? (
        !adding ? (
          <Text className="text-sm">
            No rules yet, so no orders are held. Everything a wholesale customer places goes
            through. Add a rule to hold big orders for sign-off.
          </Text>
        ) : null
      ) : (
        <RuleRows
          rules={rules}
          people={people}
          busy={updateRule.isPending || deleteRule.isPending}
          openAccount={openAccount}
          changeApprover={changeApprover}
          toggleRule={toggleRule}
          removeRule={removeRule}
        />
      )}
    </>
  );
}

function RuleRows({
  rules,
  people,
  busy,
  openAccount,
  changeApprover,
  toggleRule,
  removeRule,
}: {
  rules: ApprovalRule[];
  people: ReturnType<typeof namableApprovers>;
  busy: boolean;
  openAccount: (id: string) => void;
  changeApprover: (rule: ApprovalRule, next: string) => void;
  toggleRule: (rule: ApprovalRule, next: boolean) => void;
  removeRule: (rule: ApprovalRule) => Promise<void>;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rules.map((rule) => (
        <RuleRow
          key={rule.id}
          rule={rule}
          people={people}
          busy={busy}
          onOpenAccount={openAccount}
          onApprover={(next) => {
            changeApprover(rule, next);
          }}
          onToggle={(next) => {
            toggleRule(rule, next);
          }}
          onDelete={() => {
            void removeRule(rule);
          }}
        />
      ))}
    </ul>
  );
}
