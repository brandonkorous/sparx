// Intake / consultation form schemas (docs/79 §11).
//
// Declarative, no-code (consistent with the platform-wide "tenant trees never
// execute code" stance). A form is a typed list of fields; a submission is the
// answers, attached to a booking/attendee and mapped into the CRM record.

import { z } from 'zod';

import { Uuid } from './common';

export const IntakeFieldType = z.enum([
  'text',
  'textarea',
  'number',
  'choice',
  'multichoice',
  'boolean',
  'date',
  'file',
  'signature',
  'consent',
]);
export type IntakeFieldType = z.infer<typeof IntakeFieldType>;

export const IntakeField = z.object({
  // Stable key the answer is stored under (snake/camel, unique within a form).
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field key must be an identifier'),
  label: z.string().min(1).max(255),
  type: IntakeFieldType,
  required: z.boolean().default(false),
  help: z.string().max(1000).optional(),
  // choice / multichoice options.
  options: z.array(z.string().min(1).max(255)).max(100).optional(),
  // Map this answer onto a CRM custom-field key when the booking writes back.
  crmField: z.string().max(120).optional(),
});
export type IntakeField = z.infer<typeof IntakeField>;

export const CreateIntakeFormInput = z.object({
  name: z.string().min(1).max(255),
  fields: z.array(IntakeField).max(200).default([]),
  isActive: z.boolean().default(true),
});
export type CreateIntakeFormInput = z.infer<typeof CreateIntakeFormInput>;

export const UpdateIntakeFormInput = CreateIntakeFormInput.partial().extend({ id: Uuid });
export type UpdateIntakeFormInput = z.infer<typeof UpdateIntakeFormInput>;

export const IntakeSubmissionInput = z.object({
  formId: Uuid,
  bookingId: Uuid.nullable().optional(),
  customerId: Uuid.nullable().optional(),
  // Answer values keyed by field key. Shape is validated against the form's
  // field definitions in the service layer (required, type, option membership).
  answers: z.record(z.string(), z.unknown()).default({}),
});
export type IntakeSubmissionInput = z.infer<typeof IntakeSubmissionInput>;
