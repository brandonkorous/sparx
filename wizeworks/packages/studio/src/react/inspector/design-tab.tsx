'use client';

// Design — the semantic controls over the selected node's classes.
//
// Every chip row edits ONE group at ONE breakpoint, through silica's own
// `setTokenAt`: it removes the group's other members at that prefix and leaves
// every other token, and the same group at every other size, exactly where it
// was. Re-implementing that out here means re-implementing tokenising, prefix
// matching and the mobile-first cascade, and getting all three right.
//
// "Auto" is not the same as picking the inherited value. Cleared means "whatever
// the smaller size says" and keeps tracking later edits to it; re-declaring the
// value pins it, which looks identical today and stops following tomorrow.

import { useCallback, useMemo } from 'react';
import { Button, Input } from '@wizeworks/silicaui-react';
import {
  BREAKPOINT_CHOICES,
  declaredBreakpoints,
  setTokenAt,
  tokenStateAt,
} from '@wizeworks/silicaui-builder/react';
import type { AddressableNode } from '../../tree/walk';
import { useApply, useStudioHost } from '../context';
import type { CanvasDevice } from '../canvas/canvas';
import { groupClasses, sectionsFor, type ControlGroup } from './class-groups';

/** The container-query prefix the Inspector edits at, for a device. */
export function prefixForDevice(device: CanvasDevice): string {
  return BREAKPOINT_CHOICES.find((choice) => choice.device === device)?.prefix ?? '';
}

export function DesignTab({ node, device }: { node: AddressableNode; device: CanvasDevice }) {
  const apply = useApply();
  const host = useStudioHost();
  const prefix = prefixForDevice(device);
  const sections = useMemo(() => sectionsFor(node), [node]);

  const setGroup = useCallback(
    (group: ControlGroup, value: string) => {
      const next = setTokenAt(node.class, groupClasses(group), value, prefix);
      if (next === (node.class ?? '')) return;
      apply(`Set ${group.label.toLowerCase()}`, [
        { kind: 'node.setClass', id: node.id ?? '', value: next || undefined },
      ]);
    },
    [apply, node.class, node.id, prefix]
  );

  return (
    <div className="flex flex-col gap-5 p-3">
      {device !== 'mobile' ? (
        <p className="text-base-content bg-base-200 rounded p-2 text-sm">
          Editing what changes on {device === 'tablet' ? 'tablets and up' : 'desktop'}. Smaller
          sizes keep what they already have.
        </p>
      ) : null}

      {sections.map((section) => (
        <section key={section.key}>
          <h3 className="text-base-content mb-2 text-sm font-medium">{section.label}</h3>
          <div className="flex flex-col gap-3">
            {section.groups.map((group) => (
              <ChipRow
                key={group.key}
                group={group}
                cls={node.class}
                prefix={prefix}
                onPick={(value) => setGroup(group, value)}
              />
            ))}
          </div>
        </section>
      ))}

      <section>
        <h3 className="text-base-content mb-2 text-sm font-medium">Classes</h3>
        <Input
          size="sm"
          defaultValue={node.class ?? ''}
          key={node.id ? `${node.id}:${node.class ?? ''}` : undefined}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (value === (node.class ?? '')) return;
            const verdict = host.validateClass?.(value);
            if (verdict && !verdict.ok) {
              // Put the field back rather than accept a string the tenant's policy
              // refuses — a silent revert on save is worse than a refusal here.
              event.currentTarget.value = node.class ?? '';
              return;
            }
            apply('Set classes', [
              { kind: 'node.setClass', id: node.id ?? '', value: value || undefined },
            ]);
          }}
        />
        <p className="text-base-content mt-1 text-xs">
          The full list, for anything the controls above don’t cover.
        </p>
      </section>
    </div>
  );
}

/** What one chip in a {@link ChipRow} is currently saying. */
export interface ChipEmphasis {
  color?: 'primary';
  variant?: 'soft';
}

/**
 * How a chip should look, given the group's state at this size.
 *
 * THE VALUE IN FORCE IS ALWAYS SHOWN, whether it was declared here or inherited from
 * a smaller size, and the WEIGHT says which. It used to be shown only when declared
 * here: the selected test required `!state.inherited`, and "Auto" lights only when
 * there is no value anywhere — so a row whose value came from the base size rendered
 * six plain buttons and answered nothing. Almost everything is authored at the base
 * size and the Inspector opens on desktop, so that was the ordinary case rather than
 * an edge one. An About page column set to `max-w-2xl` — the reason it sat 240px
 * narrower than every other page on that site — asked "how wide is this?" in the one
 * control that knows, and got a blank row of six.
 *
 * SOFT rather than solid keeps the distinction this file's header is about: solid
 * means pinned at this size, soft means in force from a smaller one, and clicking a
 * soft chip still PINS it rather than being a no-op. It is the same treatment "Auto"
 * already wears for "this is what you are getting, and you did not choose it here".
 */
export function chipEmphasis(
  state: { value?: string; inherited?: boolean },
  option: string
): ChipEmphasis {
  if (state.value !== option) return {};
  return state.inherited ? { color: 'primary', variant: 'soft' } : { color: 'primary' };
}

function ChipRow({
  group,
  cls,
  prefix,
  onPick,
}: {
  group: ControlGroup;
  cls: string | undefined;
  prefix: string;
  onPick: (value: string) => void;
}) {
  const classes = groupClasses(group);
  const state = tokenStateAt(cls, classes, prefix);
  const elsewhere = declaredBreakpoints(cls, classes).filter((at) => at !== prefix);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base-content text-sm">{group.label}</span>
        {state.inherited && state.value ? (
          // The distinction a cascade indicator exists to make: this value is real,
          // and it was not set here.
          <span className="text-base-content text-xs">from a smaller size</span>
        ) : null}
        {elsewhere.length ? (
          <span className="text-base-content ml-auto text-xs">
            also set at {elsewhere.length} other size{elsewhere.length > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          {...(state.value ? {} : { color: 'primary' as const, variant: 'soft' as const })}
          onClick={() => onPick('')}
        >
          Auto
        </Button>
        {group.options.map((option) => {
          return (
            <Button
              key={option.value}
              size="sm"
              {...chipEmphasis(state, option.value)}
              onClick={() => onPick(option.value)}
            >
              {group.swatches ? (
                <span
                  aria-hidden
                  className={`mr-1 inline-block size-3 rounded-full border ${swatchClass(option.value)}`}
                />
              ) : null}
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** The swatch preview for a color option. Literal strings, mapped rather than
 *  computed, so Tailwind generates every one of them. */
function swatchClass(value: string): string {
  const SWATCHES: Record<string, string> = {
    'text-base-content': 'bg-base-content',
    'text-primary': 'bg-primary',
    'text-secondary': 'bg-secondary',
    'text-accent': 'bg-accent',
    'text-success': 'bg-success',
    'text-warning': 'bg-warning',
    'text-error': 'bg-error',
    'bg-base-100': 'bg-base-100',
    'bg-base-200': 'bg-base-200',
    'bg-base-300': 'bg-base-300',
    'bg-primary': 'bg-primary',
    'bg-secondary': 'bg-secondary',
    'bg-accent': 'bg-accent',
    'bg-neutral': 'bg-neutral',
  };
  return SWATCHES[value] ?? 'bg-base-200';
}
