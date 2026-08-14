// Inventory MCP tool registry barrel. `inventoryMcpTools` is the array the MCP
// server iterates to register inventory tools alongside the other modules'.

export type { McpScope, McpToolDefinition, AnyMcpTool } from './registry';

import { binReadTools, binWriteTools } from './bin-tools';
import { integrityReadTools, integrityWriteTools } from './integrity-tools';
import { readTools, writeTools } from './tools';
import { scanReadTools, scanWriteTools } from './scan-tools';
import { pickReadTools, pickWriteTools } from './pick-tools';
import { costingReadTools, costingWriteTools } from './costing-tools';
import { assemblyReadTools, assemblyWriteTools } from './assembly-tools';
import { planningReadTools, planningWriteTools } from './planning-tools';
import { managementWriteTools } from './write-management-tools';
import { onboardingReadTools, onboardingWriteTools } from './onboarding-tools';
import { supplierPerformanceReadTools } from './supplier-performance-tools';
import { commitmentReadTools } from './commitment-tools';
import { reportReadTools } from './report-tools';

export * from './tools';
export { managementWriteTools } from './write-management-tools';
export { integrityReadTools, integrityWriteTools } from './integrity-tools';
export { binReadTools, binWriteTools } from './bin-tools';
export { scanReadTools, scanWriteTools } from './scan-tools';
export { pickReadTools, pickWriteTools } from './pick-tools';
export { costingReadTools, costingWriteTools } from './costing-tools';
export { assemblyReadTools, assemblyWriteTools } from './assembly-tools';
export { planningReadTools, planningWriteTools } from './planning-tools';
export { onboardingReadTools, onboardingWriteTools } from './onboarding-tools';
export { supplierPerformanceReadTools } from './supplier-performance-tools';
export { commitmentReadTools } from './commitment-tools';
export { reportReadTools } from './report-tools';

/** The full Inventory tool set the MCP server publishes. */
export const inventoryMcpTools = [
  ...readTools,
  ...writeTools,
  ...managementWriteTools,
  // The "can I trust this number" tools (docs/146 Phase 1). Kept in their own
  // file because they are diagnosis rather than operation, and mixing them into
  // the supply loop would bury them.
  ...integrityReadTools,
  ...integrityWriteTools,
  // "Where is it, what's on that shelf, where should this go" (docs/146 Phase 2).
  ...binReadTools,
  ...binWriteTools,
  // "What is this, and put twelve of it on the delivery" (docs/146 Phase 3).
  // Also the path by which a phone with a camera but no barcode app becomes a
  // scanner: read the digits, pass them to `resolve_scan`.
  ...scanReadTools,
  ...scanWriteTools,
  // "Fetch these orders, and tell me when a shelf is empty" (docs/146 Phase 4).
  // Handing a sealed box to shipping is deliberately NOT here — it buys a carrier
  // label and needs the order side, so it lives in commerce's tool set.
  ...pickReadTools,
  ...pickWriteTools,
  // "What did this actually cost me once the freight is in" (docs/146 Phase 5).
  // Changing the costing METHOD is deliberately absent: switching from moving
  // average to FIFO changes every future figure and is a decision a business
  // makes with its accountant, not one an agent makes on a hunch.
  ...costingReadTools,
  ...costingWriteTools,
  // "How many can I make, and what runs out first" (docs/146 Phase 6). Editing
  // a RECIPE is deliberately absent: a bill of materials is a specification, and
  // an agent quietly changing what a product is made of is a different category
  // of mistake from mis-recording a count.
  ...assemblyReadTools,
  ...assemblyWriteTools,
  // "What should I buy today, what is dead, and why is that number that number"
  // (docs/146 Phase 7). Turning ON automatic reorder-point management is
  // deliberately absent: it hands the nightly maths permission to rewrite an
  // operational trigger every night, and the whole value of that decision is
  // that a person made it knowingly.
  ...planningReadTools,
  ...planningWriteTools,
  // "Where am I up to, and what would this spreadsheet do" (docs/146 Phase 11),
  // plus the tenant's own columns. APPLYING an import is deliberately absent:
  // it posts hundreds of movements from a file the agent read and the person
  // did not. So is creating or removing a field DEFINITION, which changes every
  // form and every export at once — both stay where somebody can see them.
  ...onboardingReadTools,
  ...onboardingWriteTools,
  // "Who is late, what is on the truck, and what am I still owed a credit for"
  // (docs/146 Phase 8). Entirely read: every write in this area is a money
  // decision pointed at another company — approving spend, opening a claim,
  // agreeing a price — and an agent should be able to tell you your worst
  // supplier is late on a third of its orders without being able to place the
  // next order with them.
  ...supplierPerformanceReadTools,
  // "What have I promised, whose stock is this, and what is about to go off"
  // (docs/146 Phase 9). Also read-only: cancelling a backorder breaks a promise
  // to a named customer, re-flagging ownership moves stock off the balance sheet
  // without a unit moving, and a markdown or write-off destroys value on the
  // strength of a date.
  ...commitmentReadTools,
  // "Run me the numbers, and tell me why the accounts disagree" (docs/146
  // Phase 10). CREATING a schedule is deliberately absent — it commits a
  // recurring send to somebody's inbox, which is outbound and permanent in a way
  // that running a report once is not.
  ...reportReadTools,
];
