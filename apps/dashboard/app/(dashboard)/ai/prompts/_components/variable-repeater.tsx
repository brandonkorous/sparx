'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Input, Label, Stack, Text } from '@sparx/ui';

import type { PromptVariable } from './prompt-types';

// The declared-variables repeater for the prompt form. Each row is the trio a
// consuming flow needs to fill a `{{placeholder}}` in the body: the key (the
// token inside the braces), a human label, and an optional example. It's a
// neutral field card on a single-module surface — identity rides the frame.

interface VariableRepeaterProps {
  variables: PromptVariable[];
  onChange: (next: PromptVariable[]) => void;
}

export function VariableRepeater({ variables, onChange }: VariableRepeaterProps) {
  function update(index: number, patch: Partial<PromptVariable>): void {
    onChange(variables.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function add(): void {
    onChange([...variables, { key: '', label: '' }]);
  }

  function remove(index: number): void {
    onChange(variables.filter((_, i) => i !== index));
  }

  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Label>Variables</Label>
        <Text size="xs" variant="muted">
          Declare each <code>{'{{placeholder}}'}</code> your body uses. The consuming flow fills
          these in; the keys you list here surface as hint chips on the prompt.
        </Text>
      </Stack>

      {variables.length > 0 && (
        <Stack gap={2}>
          {variables.map((variable, index) => (
            <Card key={index} variant="subtle" padding="sm">
              <CardContent className="p-0">
                <Stack direction="row" gap={2} align="start" wrap>
                  <Stack gap={1} className="min-w-[8rem] flex-1">
                    <Label
                      htmlFor={`var-key-${index}`}
                      className="text-[var(--color-text-tertiary)]"
                    >
                      Key
                    </Label>
                    <Input
                      id={`var-key-${index}`}
                      value={variable.key}
                      onChange={(e) => update(index, { key: e.target.value })}
                      placeholder="customer_name"
                    />
                  </Stack>
                  <Stack gap={1} className="min-w-[8rem] flex-1">
                    <Label
                      htmlFor={`var-label-${index}`}
                      className="text-[var(--color-text-tertiary)]"
                    >
                      Label
                    </Label>
                    <Input
                      id={`var-label-${index}`}
                      value={variable.label}
                      onChange={(e) => update(index, { label: e.target.value })}
                      placeholder="Customer name"
                    />
                  </Stack>
                  <Stack gap={1} className="min-w-[8rem] flex-1">
                    <Label
                      htmlFor={`var-example-${index}`}
                      className="text-[var(--color-text-tertiary)]"
                    >
                      Example (optional)
                    </Label>
                    <Input
                      id={`var-example-${index}`}
                      value={variable.example ?? ''}
                      onChange={(e) => update(index, { example: e.target.value })}
                      placeholder="Jordan"
                    />
                  </Stack>
                  <Button
                    type="button"
                    variant="ghost"
                    color="danger"
                    size="sm"
                    shape="square"
                    aria-label={`Remove variable ${variable.key || index + 1}`}
                    onClick={() => remove(index)}
                    className="mt-6"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          color="module"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={add}
        >
          Add variable
        </Button>
      </div>
    </Stack>
  );
}
