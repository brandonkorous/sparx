'use client';

// Everything a visitor types into, or ticks.
//
// The two size tokens and the border weight all land here first, and so does the
// keyboard outline — which is why one field is left focused-looking rather than
// described in a caption nobody reads.

import {
  Checkbox,
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  RadioGroup,
  RadioOption,
  Rating,
  Slider,
  Switch,
  Textarea,
  Toggle,
} from '@wizeworks/silicaui-react';
import { BoardTile, Specimen } from './tile';

export function FormsTile() {
  return (
    <BoardTile
      title="Things people fill in"
      hint="Order forms, sign-ups and checkout. Tab into one to see the keyboard outline."
    >
      <Field>
        <FieldLabel>Email address</FieldLabel>
        <Input type="email" placeholder="you@example.com" />
      </Field>

      <Field>
        <FieldLabel>How would you like it?</FieldLabel>
        <NativeSelect defaultValue="collect">
          <option value="collect">Collect in store</option>
          <option value="deliver">Deliver to me</option>
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel>Anything else?</FieldLabel>
        <Textarea rows={2} placeholder="Leave it at the side gate" />
      </Field>

      <Specimen label="Ticks and switches">
        <Checkbox color="primary" defaultChecked aria-label="Send me offers" />
        <Checkbox color="primary" aria-label="Gift wrap" />
        <Switch color="primary" defaultChecked aria-label="Keep me signed in" />
        <Toggle color="primary" defaultChecked>
          Keep me posted
        </Toggle>
        <Rating color="warning" defaultValue={4} label="How it went" />
      </Specimen>

      <RadioGroup defaultValue="standard" orientation="horizontal" color="primary">
        <RadioOption value="standard">Standard</RadioOption>
        <RadioOption value="express">Express, next day</RadioOption>
      </RadioGroup>

      <Slider color="primary" defaultValue={60} aria-label="How much" />
    </BoardTile>
  );
}
