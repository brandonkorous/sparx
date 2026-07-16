'use client';

// The Utility allowlist editor (docs/61 §8 Phase 6b) — the brand-designer's
// governance surface for the builder's safety policy. Two sections:
//   · Platform protections (read-only) — the base rules + WHY each is blocked.
//   · Your additional blocks (editable) — tighten-only rules the tenant adds.
// Plus a non-fatal advisory listing author classes currently dropped, so the
// author understands why a class they typed didn't render.
//
// Tenant CAN ONLY TIGHTEN — there is no "unblock"; the platform protections
// always apply. An explicit Save (not autosave) makes a tightening deliberate.

import * as React from 'react';
import { AlertTriangle, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  NativeSelect,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';

import { updateAllowlist } from '../lib/actions';
import type { AllowlistDto, AllowlistRuleDto, AllowlistRuleKind } from '../lib/types';

const KIND_HINT: Record<AllowlistRuleKind, string> = {
  prefix: 'Blocks every class starting with this — e.g. “animate-” bans all animations.',
  exact: 'Blocks this one class exactly — e.g. “blur-sm”.',
  substring: 'Blocks any class containing this fragment — e.g. “[url”.',
};

interface DraftRule extends AllowlistRuleDto {
  /** Stable client id for list keys (rules carry no server id). */
  uid: string;
}

let _uid = 0;
const nextUid = () => `r${++_uid}`;
const toDraft = (rules: AllowlistRuleDto[]): DraftRule[] =>
  rules.map((r) => ({ ...r, uid: nextUid() }));
const normalize = (rules: DraftRule[]): AllowlistRuleDto[] =>
  rules.map((r) => ({ kind: r.kind, value: r.value.trim() })).filter((r) => r.value.length > 0);

export function AllowlistCenter({
  initial,
  blocked,
  canEdit,
}: {
  initial: AllowlistDto;
  blocked: string[];
  canEdit: boolean;
}) {
  const confirm = useConfirm();
  const [rules, setRules] = React.useState<DraftRule[]>(() => toDraft(initial.tenant));
  const [saved, setSaved] = React.useState<AllowlistRuleDto[]>(initial.tenant);
  const [busy, setBusy] = React.useState(false);

  const normalized = normalize(rules);
  const dirty = JSON.stringify(normalized) !== JSON.stringify(saved);

  const addRule = () => setRules((rs) => [...rs, { uid: nextUid(), kind: 'prefix', value: '' }]);
  const setRule = (uid: string, patch: Partial<AllowlistRuleDto>) =>
    setRules((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  const removeRule = async (uid: string) => {
    const rule = rules.find((r) => r.uid === uid);
    if (!rule) return;
    // Removing a rule that's currently SAVED is destructive — its blocked classes
    // start compiling again on the next publish. Confirm. A never-saved empty row
    // just drops.
    const isSaved = saved.some((s) => s.kind === rule.kind && s.value === rule.value.trim());
    if (isSaved) {
      const ok = await confirm({
        title: `Stop blocking “${rule.value.trim()}”?`,
        description:
          'Classes matching this rule will be allowed to compile again on your next publish.',
        confirmLabel: 'Remove block',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setRules((rs) => rs.filter((r) => r.uid !== uid));
  };

  const onSave = async () => {
    setBusy(true);
    const res = await updateAllowlist(normalized);
    setBusy(false);
    if (res.ok && res.data) {
      setSaved(res.data.tenant);
      setRules(toDraft(res.data.tenant));
      toast.success('Allowlist saved.');
    } else {
      toast.error(res.error ?? 'Could not save the allowlist.');
    }
  };

  return (
    <Stack gap={6}>
      {/* Section A — Platform protections (read-only) */}
      <Card>
        <CardContent>
          <Stack gap={3}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-module h-4 w-4" aria-hidden />
              <Text weight="medium">Platform protections</Text>
              <Badge color="success" variant="soft" size="sm">
                Always on
              </Badge>
            </div>
            <Text variant="muted">
              These safety rules are always enforced and can’t be turned off — they protect every
              site on your account.
            </Text>
            <Stack gap={2}>
              {initial.base.map((rule) => (
                <div key={rule.label} className="flex items-start gap-2.5">
                  <Lock className="text-base-content mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <Text size="sm">
                    <span className="font-mono">{rule.label}</span> — {rule.reason}
                  </Text>
                </div>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Section B — tenant additions (editable) */}
      <Card>
        <CardContent>
          <Stack gap={4}>
            <div>
              <Text weight="medium">Your additional blocks</Text>
              <Text variant="muted">
                Tighten further by blocking specific utility classes across all your sites. You can
                only add restrictions — the platform protections above always apply.
              </Text>
            </div>

            {rules.length === 0 ? (
              <Text variant="muted">
                No additional blocks. Every safe utility class is available to your authors.
              </Text>
            ) : (
              <Stack gap={3}>
                {rules.map((r) => (
                  <div key={r.uid} className="flex flex-wrap items-start gap-2">
                    <NativeSelect
                      aria-label="Match type"
                      value={r.kind}
                      disabled={!canEdit || busy}
                      onChange={(e) =>
                        setRule(r.uid, { kind: e.target.value as AllowlistRuleKind })
                      }
                      className="w-36"
                    >
                      <option value="prefix">Starts with</option>
                      <option value="exact">Exactly</option>
                      <option value="substring">Contains</option>
                    </NativeSelect>
                    <div className="min-w-48 flex-1">
                      <Input
                        aria-label="Class fragment to block"
                        placeholder="e.g. animate-"
                        value={r.value}
                        maxLength={64}
                        disabled={!canEdit || busy}
                        onChange={(e) => setRule(r.uid, { value: e.target.value })}
                      />
                      <Text variant="muted" size="xs" className="mt-1">
                        {KIND_HINT[r.kind]}
                      </Text>
                    </div>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Remove block"
                        onClick={() => void removeRule(r.uid)}
                        disabled={busy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </Stack>
            )}

            {canEdit ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={addRule}
                  disabled={busy}
                >
                  Add block
                </Button>
                <Button variant="solid" onClick={() => void onSave()} disabled={!dirty || busy}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            ) : (
              <Text variant="muted">Only owners and admins can change the allowlist.</Text>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Advisory — author classes the allowlist currently drops */}
      {blocked.length > 0 ? (
        <Alert
          color="warning"
          icon={<AlertTriangle aria-hidden />}
          title={`${blocked.length} authored ${blocked.length === 1 ? 'class is' : 'classes are'} being blocked`}
        >
          These appear in your drafts but won’t render because the allowlist blocks them:{' '}
          <span className="font-mono">{blocked.join(', ')}</span>
        </Alert>
      ) : null}
    </Stack>
  );
}
