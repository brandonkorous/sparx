import { z } from 'zod';

// Built-in transactional template override — constrained customization only.
export const SaveBuiltinOverrideInput = z
  .object({
    subject: z.string().max(255).optional(),
    intro: z.string().max(2000).optional(),
    outro: z.string().max(2000).optional(),
  })
  .strict();

export type SaveBuiltinOverrideInput = z.infer<typeof SaveBuiltinOverrideInput>;

// Marketing emails are authored in the Builder (docs/52, BuilderEmail), not as
// section-list "authored templates" — that model is retired (docs/52 §8). This
// service owns builtins only, so the authored-template inputs are gone.

export const TestSendInput = z.object({ to: z.string().email() }).strict();
export type TestSendInput = z.infer<typeof TestSendInput>;
