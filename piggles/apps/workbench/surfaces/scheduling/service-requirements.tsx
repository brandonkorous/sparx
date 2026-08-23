'use client';

// WHO OR WHAT A BOOKING NEEDS — and, now, WHICH of them can actually do it.
//
// "What it is" was a label the booking engine never read, so a salon could not
// say that only Dara does the fades and clients were offered whoever was free
// (issue 088). The engine matches on SKILLS, so the skills are on the row, and
// the row says out loud who currently fits — an unmatched skill is otherwise
// indistinguishable from a matched one until somebody turns up at the chair.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Button,
} from '@wizeworks/silicaui-react';
import { faPlus, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { FitLine, parseSkills } from './service-fit-line';
import {
  useResources,
  ASSIGNMENT_STRATEGIES,
  RESOURCE_KINDS,
  type AssignmentStrategy,
  type ResourceKind,
  type ResourceRequirement,
} from './setup-data';

export function ServiceRequirements({
  requirements,
  strategy,
  onChange,
  onChangeStrategy,
}: {
  requirements: ResourceRequirement[];
  strategy: AssignmentStrategy;
  onChange: (requirements: ResourceRequirement[]) => void;
  onChangeStrategy: (strategy: AssignmentStrategy) => void;
}) {
  // The real records, not the calendar's light list — the light one carries no
  // skills, which is the whole question this section is answering.
  const resources = useResources({ activeOnly: true });
  const people = resources.data?.items ?? [];
  const strategyHint = ASSIGNMENT_STRATEGIES.find((entry) => entry.value === strategy)?.hint ?? '';
  // "Everyone at once" needs listed roles to hold at once, so it only means
  // something once something is listed. Every other answer is about WHO takes a
  // booking, which is a live question the moment two people can take it.
  const strategyOptions = ASSIGNMENT_STRATEGIES.filter(
    (entry) => entry.value !== 'collective' || requirements.length > 0
  );

  const update = (index: number, patch: Partial<ResourceRequirement>) => {
    onChange(requirements.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  return (
    <FormSection
      title="Who or what it needs"
      description="What a booking uses up — a member of staff, a room, a machine. Two bookings can never claim the same one at the same time. Leave this empty if a booking needs nothing set aside."
    >
      <Field>
        <FieldLabel>Who takes the booking</FieldLabel>
        <FieldControl
          render={
            <NativeSelect
              value={strategy}
              aria-label="Who takes the booking"
              onChange={(event) => {
                onChangeStrategy(event.target.value as AssignmentStrategy);
              }}
            >
              {strategyOptions.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </NativeSelect>
          }
        />
        {strategyHint ? <FieldDescription>{strategyHint}</FieldDescription> : null}
      </Field>

      <div className="flex flex-col gap-3">
        {requirements.map((requirement, index) => (
          <div
            key={index}
            className="border-base-300 flex flex-col gap-3 rounded-lg border p-3"
            data-requirement-row
          >
            <div className="flex flex-col gap-3 @md:flex-row @md:items-end">
              <Field className="min-w-0 flex-1">
                <FieldLabel>What it is</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={requirement.role}
                      placeholder="Stylist"
                      onChange={(event) => {
                        update(index, { role: event.target.value });
                      }}
                    />
                  }
                />
                <FieldDescription>Your name for it, so the diary reads clearly.</FieldDescription>
              </Field>

              <Field className="min-w-0 @md:w-44">
                <FieldLabel>Kind</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      value={requirement.kind}
                      aria-label="Kind of resource needed"
                      onChange={(event) => {
                        update(index, { kind: event.target.value as ResourceKind });
                      }}
                    >
                      {RESOURCE_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </NativeSelect>
                  }
                />
              </Field>

              <Field className="min-w-0 @md:w-28">
                <FieldLabel>How many</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={1}
                      className="tabular-nums"
                      aria-label="How many are needed"
                      value={requirement.count}
                      onChange={(event) => {
                        update(index, { count: Math.max(1, Number(event.target.value) || 1) });
                      }}
                    />
                  }
                />
              </Field>

              <Button
                size="sm"
                variant="ghost"
                color="danger"
                shape="square"
                aria-label="Remove this"
                onClick={() => {
                  onChange(requirements.filter((_, i) => i !== index));
                }}
              >
                <Icon glyph={faXmark} className="size-4" aria-hidden />
              </Button>
            </div>

            <Field>
              <FieldLabel>Only people with</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={requirement.skillTags.join(', ')}
                    placeholder="barbering, color"
                    aria-label="Skills this needs"
                    onChange={(event) => {
                      update(index, { skillTags: parseSkills(event.target.value) });
                    }}
                  />
                }
              />
              <FitLine requirement={requirement} people={people} />
            </Field>
          </div>
        ))}

        <div>
          <Button
            size="sm"
            variant="soft"
            color="module"
            onClick={() => {
              onChange([...requirements, { role: '', kind: 'staff', skillTags: [], count: 1 }]);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add something it needs
          </Button>
        </div>
      </div>
    </FormSection>
  );
}
