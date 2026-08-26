'use client';

// The forms behind a return's lifecycle moves — one file each, gathered here.
//
// Each collects the handful of facts one transition needs (the approved
// quantities, a reason for turning it down, the condition of what came back,
// the amount to give back, the replacement to send) and commits it straight to
// the server. Their shared chrome is ./return-action-dialog, which also says
// why they are modals rather than panes.

export { ApproveReturnModal } from './return-approve-modal';
export { DenyReturnModal } from './return-deny-modal';
export { InspectReturnModal } from './return-inspect-modal';
export { RefundReturnModal } from './return-refund-modal';
export { ExchangeReturnModal } from './return-exchange-modal';
