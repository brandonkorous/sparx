'use client';

// What the theme actually looks like, on real controls.
//
// Real silica components, not swatches. A swatch grid answers "what color is
// primary"; nobody is asking that. What an author needs to see is whether a
// button is readable, whether a card separates from the page, and whether the
// alert they will use for a failed payment looks like a problem — which only the
// components themselves can show.
//
// Rendered inside `[data-studio-theme-preview]`, which the builder scopes the
// theme stylesheet to, so this is the theme being edited rather than the console's.

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Input,
} from '@wizeworks/silicaui-react';

export function ThemePreview({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <div
      data-studio-theme-preview=""
      data-theme={mode}
      className="bg-base-100 text-base-content flex h-full flex-col gap-4 p-4"
    >
      <div>
        <h2 className="text-2xl font-semibold">Fresh from the oven</h2>
        <p className="mt-1">
          Sourdough, pastries and coffee, seven days a week. This is what your words look like on
          your page.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button color="primary">Order now</Button>
        <Button color="secondary">See the menu</Button>
        <Button color="accent" variant="soft">
          Book a table
        </Button>
        <Button variant="outline">Contact</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge color="success" variant="soft">
          Open
        </Badge>
        <Badge color="warning" variant="soft">
          Low stock
        </Badge>
        <Badge color="error" variant="soft">
          Sold out
        </Badge>
        <Badge color="info" variant="soft">
          New
        </Badge>
      </div>

      <Card>
        <CardBody>
          <CardTitle>Saturday market box</CardTitle>
          <p>Two loaves, a dozen rolls and whatever came out best that morning.</p>
          <Input placeholder="Your email" className="mt-3" />
        </CardBody>
      </Card>

      <Alert color="success" variant="soft">
        <AlertTitle>Order confirmed</AlertTitle>
        <AlertDescription>We’ll have it ready by eight.</AlertDescription>
      </Alert>

      <Alert color="error" variant="soft">
        <AlertTitle>That card was declined</AlertTitle>
        <AlertDescription>Try another, or pay when you collect.</AlertDescription>
      </Alert>
    </div>
  );
}
