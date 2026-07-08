'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, Input, Label } from 'silicaui-react';

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label>Variables</Label>
        <p className="text-base-content/70 text-xs">
          Declare each <code>{'{{placeholder}}'}</code> your body uses. The consuming flow fills
          these in; the keys you list here surface as hint chips on the prompt.
        </p>
      </div>

      {variables.length > 0 && (
        <div className="flex flex-col gap-2">
          {variables.map((variable, index) => (
            <Card key={index} className="bg-base-200">
              <CardBody className="p-3">
                <div className="flex flex-row flex-wrap items-start gap-2">
                  <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
                    <Label htmlFor={`var-key-${index}`} className="text-base-content/50">
                      Key
                    </Label>
                    <Input
                      id={`var-key-${index}`}
                      value={variable.key}
                      onChange={(e) => update(index, { key: e.target.value })}
                      placeholder="customer_name"
                    />
                  </div>
                  <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
                    <Label htmlFor={`var-label-${index}`} className="text-base-content/50">
                      Label
                    </Label>
                    <Input
                      id={`var-label-${index}`}
                      value={variable.label}
                      onChange={(e) => update(index, { label: e.target.value })}
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
                    <Label htmlFor={`var-example-${index}`} className="text-base-content/50">
                      Example (optional)
                    </Label>
                    <Input
                      id={`var-example-${index}`}
                      value={variable.example ?? ''}
                      onChange={(e) => update(index, { example: e.target.value })}
                      placeholder="Jordan"
                    />
                  </div>
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
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          color="module"
          size="sm"
          iconStart={<Plus className="h-4 w-4" />}
          onClick={add}
        >
          Add variable
        </Button>
      </div>
    </div>
  );
}
