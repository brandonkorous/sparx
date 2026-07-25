// Scheduling lifecycle MCP tools — everything past create/reschedule/cancel:
// the booking state machine (confirm / check-in / complete / no-show / edit),
// attendees, recurring series, waitlist, booking policies, and one-off
// availability exceptions. Thin wrappers over the scheduling engine (one
// service, many transports), so the no-overlap + state-machine guarantees hold
// identically to an MCP call. Basic CRUD + hours live in ./write-tools.ts.
//
// Deliberately NOT here (calendar-integration provisioning): CalDAV / iCal /
// OAuth calendar connections + their sync.

import { z } from 'zod';

import {
  AcceptWaitlistInput,
  AvailabilityExceptionInput,
  CancelBookingSeriesInput,
  CheckInInput,
  CreateBookingPolicyInput,
  CreateBookingSeriesInput,
  CreateWaitlistEntryInput,
  JoinSessionInput,
  NoShowBookingInput,
  OfferWaitlistInput,
  UpdateAttendeeInput,
  UpdateBookingInput,
  UpdateBookingPolicyInput,
} from '@sparx/scheduling-schemas';

import { createAvailabilityException, deleteAvailabilityException } from '../availability-rules';
import {
  checkInBooking,
  completeBooking,
  confirmBooking,
  noShowBooking,
  updateBooking,
} from '../booking-service';
import { bookClassSeat, updateAttendee } from '../classes';
import { createBookingPolicy, deleteBookingPolicy, updateBookingPolicy } from '../policies';
import { cancelBookingSeries, createBookingSeries } from '../series';
import { acceptWaitlistOffer, joinWaitlist, leaveWaitlist, offerWaitlistEntry } from '../waitlist';

import type { McpToolDefinition } from './registry';

const uuid = () => z.string().uuid();

// ─── Booking state machine ────────────────────────────────────────────────

const confirmBookingTool: McpToolDefinition = {
  name: 'confirm_booking',
  description: 'Confirm a pending (e.g. deposit-held or request) booking so it is locked in.',
  scope: 'write:scheduling',
  confirmation: true,
  input: z.object({ bookingId: uuid() }),
  run: (ctx, input) =>
    confirmBooking(ctx.tenantId, (input as { bookingId: string }).bookingId, ctx.userId),
};

const checkInBookingTool: McpToolDefinition = {
  name: 'check_in_booking',
  description: 'Mark a booking (or a specific class attendee) as checked in / arrived.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CheckInInput,
  run: (ctx, input) => checkInBooking(ctx.tenantId, input as CheckInInput, ctx.userId),
};

const completeBookingTool: McpToolDefinition = {
  name: 'complete_booking',
  description: 'Mark a booking as completed (the service was delivered).',
  scope: 'write:scheduling',
  confirmation: true,
  input: z.object({ bookingId: uuid() }),
  run: (ctx, input) =>
    completeBooking(ctx.tenantId, (input as { bookingId: string }).bookingId, ctx.userId),
};

const noShowBookingTool: McpToolDefinition = {
  name: 'no_show_booking',
  description: 'Mark a booking as a no-show, optionally waiving any no-show fee.',
  scope: 'write:scheduling',
  confirmation: true,
  input: NoShowBookingInput,
  run: (ctx, input) => noShowBooking(ctx.tenantId, input as NoShowBookingInput, ctx.userId),
};

const updateBookingTool: McpToolDefinition = {
  name: 'update_booking',
  description:
    'Edit a booking’s notes / staff notes / asset reference (not its time — use reschedule_booking).',
  scope: 'write:scheduling',
  confirmation: true,
  input: UpdateBookingInput,
  run: (ctx, input) => updateBooking(ctx.tenantId, input as UpdateBookingInput, ctx.userId),
};

// ─── Attendees (classes / group bookings) ─────────────────────────────────

const addSessionAttendeeTool: McpToolDefinition = {
  name: 'add_session_attendee',
  description:
    'Add an attendee (a seat) to a class/group session booking, with an optional party size.',
  scope: 'write:scheduling',
  confirmation: true,
  input: JoinSessionInput,
  run: (ctx, input) => bookClassSeat(ctx.tenantId, input as JoinSessionInput),
};

const updateAttendeeTool: McpToolDefinition = {
  name: 'update_attendee',
  description: 'Update a class attendee — their status or party size.',
  scope: 'write:scheduling',
  confirmation: true,
  input: UpdateAttendeeInput,
  run: (ctx, input) => updateAttendee(ctx.tenantId, input as UpdateAttendeeInput),
};

// ─── Recurring series ─────────────────────────────────────────────────────

const createBookingSeriesTool: McpToolDefinition = {
  name: 'create_booking_series',
  description:
    'Create a recurring booking series from a recurrence rule; the engine materializes the individual bookings.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CreateBookingSeriesInput,
  run: (ctx, input) =>
    createBookingSeries(ctx.tenantId, input as CreateBookingSeriesInput, ctx.userId),
};

const cancelBookingSeriesTool: McpToolDefinition = {
  name: 'cancel_booking_series',
  description: 'Cancel a recurring booking series (optionally its future occurrences).',
  scope: 'write:scheduling',
  confirmation: true,
  input: CancelBookingSeriesInput,
  run: (ctx, input) => cancelBookingSeries(ctx.tenantId, input as CancelBookingSeriesInput),
};

// ─── Waitlist ─────────────────────────────────────────────────────────────

const joinWaitlistTool: McpToolDefinition = {
  name: 'join_waitlist',
  description: 'Add a customer to a service/slot waitlist.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CreateWaitlistEntryInput,
  run: (ctx, input) => joinWaitlist(ctx.tenantId, input as CreateWaitlistEntryInput),
};

const offerWaitlistTool: McpToolDefinition = {
  name: 'offer_waitlist_entry',
  description:
    'Offer an opened slot to a waitlist entry, holding it for a TTL before it passes to the next in line.',
  scope: 'write:scheduling',
  confirmation: true,
  input: OfferWaitlistInput,
  run: (ctx, input) => {
    const { id, offerTtlMinutes } = input as { id: string; offerTtlMinutes?: number };
    return offerWaitlistEntry(ctx.tenantId, id, offerTtlMinutes);
  },
};

const acceptWaitlistTool: McpToolDefinition = {
  name: 'accept_waitlist_offer',
  description: 'Accept a held waitlist offer, converting it into a booking.',
  scope: 'write:scheduling',
  confirmation: true,
  input: AcceptWaitlistInput,
  run: (ctx, input) => acceptWaitlistOffer(ctx.tenantId, input as AcceptWaitlistInput),
};

const leaveWaitlistTool: McpToolDefinition = {
  name: 'leave_waitlist',
  description: 'Remove an entry from a waitlist.',
  scope: 'write:scheduling',
  confirmation: true,
  input: z.object({ entryId: uuid() }),
  run: (ctx, input) => leaveWaitlist(ctx.tenantId, (input as { entryId: string }).entryId),
};

// ─── Booking policies ─────────────────────────────────────────────────────

const createBookingPolicyTool: McpToolDefinition = {
  name: 'create_booking_policy',
  description:
    'Create a booking policy — lead time, cancellation window, deposit / no-show fee rules — that services reference.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CreateBookingPolicyInput,
  run: (ctx, input) => createBookingPolicy(ctx.tenantId, input as CreateBookingPolicyInput),
};

const updateBookingPolicyTool: McpToolDefinition = {
  name: 'update_booking_policy',
  description: 'Edit a booking policy. Send only the fields to change.',
  scope: 'write:scheduling',
  confirmation: true,
  input: UpdateBookingPolicyInput,
  run: (ctx, input) => updateBookingPolicy(ctx.tenantId, input as UpdateBookingPolicyInput),
};

const deleteBookingPolicyTool: McpToolDefinition = {
  name: 'delete_booking_policy',
  description: 'Delete a booking policy.',
  scope: 'write:scheduling',
  confirmation: true,
  input: z.object({ policyId: uuid() }),
  run: (ctx, input) => deleteBookingPolicy(ctx.tenantId, (input as { policyId: string }).policyId),
};

// ─── Availability exceptions ──────────────────────────────────────────────

const createAvailabilityExceptionTool: McpToolDefinition = {
  name: 'create_availability_exception',
  description:
    'Create a one-off availability exception — a closure (holiday) or extra open window that overrides the recurring hours on a date.',
  scope: 'write:scheduling',
  confirmation: true,
  input: AvailabilityExceptionInput,
  run: (ctx, input) =>
    createAvailabilityException(ctx.tenantId, input as AvailabilityExceptionInput),
};

const deleteAvailabilityExceptionTool: McpToolDefinition = {
  name: 'delete_availability_exception',
  description: 'Remove an availability exception (the recurring hours apply again on that date).',
  scope: 'write:scheduling',
  confirmation: true,
  input: z.object({ exceptionId: uuid() }),
  run: (ctx, input) =>
    deleteAvailabilityException(ctx.tenantId, (input as { exceptionId: string }).exceptionId),
};

export const lifecycleWriteTools = [
  confirmBookingTool,
  checkInBookingTool,
  completeBookingTool,
  noShowBookingTool,
  updateBookingTool,
  addSessionAttendeeTool,
  updateAttendeeTool,
  createBookingSeriesTool,
  cancelBookingSeriesTool,
  joinWaitlistTool,
  offerWaitlistTool,
  acceptWaitlistTool,
  leaveWaitlistTool,
  createBookingPolicyTool,
  updateBookingPolicyTool,
  deleteBookingPolicyTool,
  createAvailabilityExceptionTool,
  deleteAvailabilityExceptionTool,
];
