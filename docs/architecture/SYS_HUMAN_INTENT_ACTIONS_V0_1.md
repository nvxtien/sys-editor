# Sys Human Intent Actions v0.1 - Architecture

## Overview

This document describes the architecture and implementation of the **Sys Human Intent Actions v0.1** milestone, which adds human decision workspace capabilities to the read-only Sys Semantic Workbench Shell v0.1.

## Goal

Turn the existing read-only `Unresolved Intent` surface into a **human decision workspace** where users can:

1. Select an unresolved intent item
2. Enter a clarification
3. Review exactly what they entered
4. Explicitly confirm the clarification
5. Leave the item unresolved instead
6. Replace a previously confirmed clarification only after seeing old vs new meaning

## Architecture Principles

### Product Boundary

The architecture maintains a clear separation:

- **nvxtien/sys-platform** = semantic/governance authority
- **nvxtien/sys-editor** = interaction/visualization shell

### Durable Invariants

- GUI may present trusted meaning
- GUI may collect human meaning
- GUI may **not** invent human meaning
- GUI confirmation != governed spec approval
- The editor must never silently promote an entered clarification into governed authority

## Component Design

### 1. State Model (`sysIntentAction.ts`)

**Location:** `src/vs/workbench/contrib/sys/common/sysIntentAction.ts`

#### Types

```typescript
// Governance state - external authority
type SysGovernanceState = 'NOT_GOVERNED' | 'GOVERNED';

// Interaction status - GUI workflow
type SysIntentStatus = 'UNRESOLVED' | 'CANDIDATE' | 'CONFIRMED';

// Intent item model
interface SysIntentItem {
  id: string;
  title: string;
  question: string;
  status: SysIntentStatus;
  candidateMeaning?: string;
  confirmedMeaning?: string;
  leftOpenByHuman: boolean;
  governanceState: SysGovernanceState;
}

// Detail view model
interface SysIntentItemDetails {
  item: SysIntentItem;
  isReplacing: boolean;
  replacementOldMeaning?: string;
  replacementNewMeaning?: string;
}
```

#### Service Interface

```typescript
interface ISysIntentActionService {
  getIntentItems(): Promise<readonly SysIntentItem[]>;
  getIntentItemDetails(id: string): Promise<SysIntentItemDetails | undefined>;
  proposeClarification(id: string, text: string): Promise<void>;
  confirmClarification(id: string): Promise<void>;
  leaveUnresolved(id: string): Promise<void>;
  proposeReplacement(id: string, text: string): Promise<void>;
  confirmReplacement(id: string): Promise<void>;
  cancelReplacement(id: string): Promise<void>;
  readonly onDidChangeIntentItems: Event<void>;
}
```

### 2. Action Service (`sysIntentActionService.ts`)

**Location:** `src/vs/workbench/contrib/sys/browser/sysIntentActionService.ts`

#### Responsibilities

- Manages human intent interaction state
- Uses workspace storage for persistence across sessions
- Implements state transitions:
  - `UNRESOLVED` -> `CANDIDATE` (when user enters text)
  - `CANDIDATE` -> `CONFIRMED` (when user explicitly confirms)
  - `CONFIRMED` -> `CONFIRMED` with new meaning (when replacement is confirmed)
- Maintains in-memory replacement state (not persisted)
- Validates stored data on initialization
- Falls back to fixture data if no stored data exists

#### Key Implementation Details

- **Storage Key:** `sys.intentItems`
- **Scope:** `StorageScope.WORKSPACE`
- **Target:** `StorageTarget.USER`
- **Fixture:** `CINEMA_BOOKING_INTENT_ITEMS` (customer validation, status transition rules)

#### Flow Control

```
UNRESOLVED
    -> human enters clarification
    -> CANDIDATE
    -> human explicitly confirms
    -> CONFIRMED HUMAN INTENT
    (governance state: NOT_GOVERNED)
```

Replacement flow:
```
CONFIRMED (old meaning)
    -> proposeReplacement (shows old vs new)
    -> confirmReplacement
    -> CONFIRMED (new meaning)
    (or cancelReplacement -> back to old)
```

### 3. View Layer (`sysSemanticWorkbenchView.ts`)

**Location:** `src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts`

#### Responsibilities

- Displays project semantic snapshot (read-only)
- Shows clickable unresolved intent items
- Shows clickable confirmed intent items
- Renders inline detail view when item is clicked
- Manages navigation between list and detail views

#### State Transitions in View

1. **List View:** Shows all intent items grouped by status
2. **Detail View:** Shows single item with:
   - Header with back button
   - Status badges (interaction + governance)
   - Question/reason
   - Input area (for UNRESOLVED/CANDIDATE)
   - Review panel (for CANDIDATE)
   - Action buttons
   - Confirmation/replacement flows

#### Clickable Items

- All unresolved items are clickable
- All confirmed items are clickable
- Clicking navigates to detail view inline
- Back button returns to list view

### 4. Styling (`sysSemanticWorkbench.css`)

**Location:** `src/vs/workbench/contrib/sys/browser/media/sysSemanticWorkbench.css`

#### Key Style Classes

- `.sys-intent-detail` - Detail view container
- `.sys-intent-detail-header` - Detail header with back button
- `.sys-intent-back-btn` - Back navigation button
- `.sys-intent-textarea` - Text input area
- `.sys-intent-actions` - Action button container
- `.sys-intent-btn` - Base button style
- `.sys-intent-btn-primary` - Primary action button
- `.sys-intent-btn-secondary` - Secondary action button
- `.sys-status-badge` - Status indicator
- `.sys-governance-badge` - Governance state indicator
- `.sys-list-item-clickable` - Clickable list item

#### Status Colors

- `UNRESOLVED` - Yellow/orange
- `CANDIDATE` - Blue
- `CONFIRMED` - Green
- `LEFT OPEN BY HUMAN` - Orange
- `NOT YET GOVERNED` - Orange
- `GOVERNED` - Green

### 5. Tests (`sysIntentAction.test.ts`)

**Location:** `src/vs/workbench/contrib/sys/common/test/sysIntentAction.test.ts`

#### Test Coverage

- **H1-H13:** All 13 acceptance criteria
- **C1-C3:** All 3 Cinema Booking fixture flows
- **Serialization:** JSON serialization/deserialization

#### Test Runner

```bash
node --experimental-strip-types --test src/vs/workbench/contrib/sys/common/test/sysIntentAction.test.ts
```

## State Flow

### Main Flow

```
┌─────────────────┐
│   UNRESOLVED    │
└────────┬────────┘
         │
         ▼ (user enters text)
┌─────────────────┐
│   CANDIDATE      │
│   (user text     │
│    stored exactly)│
└────────┬────────┘
         │
         ▼ (explicit confirm)
┌─────────────────┐
│   CONFIRMED     │
│   HUMAN INTENT   │
│   NOT YET        │
│   GOVERNED       │
└─────────────────┘
```

### Leave Unresolved Flow

```
┌─────────────────┐
│   UNRESOLVED    │
└─────────────────┘
     │
     ▼ (user clicks "Leave unresolved")
┌─────────────────┐
│   UNRESOLVED    │
│   leftOpenBy    │
│   Human = true  │
└─────────────────┘
```

### Replacement Flow

```
┌─────────────────────────┐
│   CONFIRMED              │
│   meaning: "old text"     │
└─────────────┬───────────┘
              │
              ▼ (user clicks "Replace")
┌─────────────────────────┐
│   REPLACEMENT MODE       │
│   Old: "old text"         │
│   New: [input]            │
└─────────────┬───────────┘
              │
         ┌────┴────┐
         ▼         ▼
    ┌─────────┐ ┌─────────┐
    │ Cancel  │ │ Confirm │
    └─────────┘ └─────────┘
         │         │
         ▼         ▼
┌─────────────┐ ┌─────────────┐
│ Old state   │ │ New state   │
│ preserved   │ │ saved       │
└─────────────┘ └─────────────┘
```

## Governance Distinction

The implementation maintains a clear visual and semantic distinction:

| Aspect | GUI State | Governance State | Display |
|--------|-----------|----------------|---------|
| User enters text | CANDIDATE | NOT_GOVERNED | "CANDIDATE" badge + "NOT YET GOVERNED" badge |
| User confirms | CONFIRMED | NOT_GOVERNED | "CONFIRMED HUMAN INTENT" + "NOT YET GOVERNED" |
| External approval | CONFIRMED | GOVERNED | "CONFIRMED HUMAN INTENT" + "GOVERNED" |

**Important:** The GUI never uses the word "Approved" or "Governed" unless the authoritative backend explicitly states so.

## Persistence

- Uses existing `IStorageService`
- Scope: `WORKSPACE` (per project)
- Target: `USER` (user-specific)
- Key: `sys.intentItems`
- Format: JSON array of `SysIntentItem`

### Initialization

1. Attempt to load from storage
2. If valid data exists, use it
3. If not, initialize from `CINEMA_BOOKING_INTENT_ITEMS` fixture
4. Fixture provides 2 items:
   - `customer-validation`
   - `status-transition-rules`

### Validation

On initialization, all stored items are validated:
- Must have: id (string), title (string), question (string)
- status must be one of: UNRESOLVED, CANDIDATE, CONFIRMED
- governanceState must be one of: NOT_GOVERNED, GOVERNED
- leftOpenByHuman must be boolean

Invalid items are silently dropped.

## Integration Points

### With Existing Sys Snapshot Service

- `ISysSemanticSnapshotService` remains the read model
- Provides governed intent, sync state, etc.
- `ISysIntentActionService` is the write model for human intent

### With View System

- Single view: `SYS_VIEW_ID = 'workbench.view.sys.semanticWorkbench'`
- Inline detail navigation (no separate view)
- Uses existing SideX/VS Code patterns:
  - `ViewPane` base class
  - Dependency injection
  - Event system

### With Storage System

- Uses `IStorageService` from `vs/platform/storage`
- No new database created
- No new persistence framework
- Consistent with existing workbench storage patterns

## Accessibility

All UI elements follow VS Code accessibility conventions:

- Keyboard reachable actions
- Visible focus state
- Buttons have understandable labels
- Text area/input has accessible labels (`aria-label`)
- State not conveyed by color alone (text labels + colors)
- Confirmation dialog makes authority distinction readable

## File Changes

### New Files

1. `src/vs/workbench/contrib/sys/common/sysIntentAction.ts` - State model and service interface
2. `src/vs/workbench/contrib/sys/browser/sysIntentActionService.ts` - Service implementation
3. `src/vs/workbench/contrib/sys/common/test/sysIntentAction.test.ts` - Unit tests

### Modified Files

1. `src/vs/workbench/contrib/sys/browser/sys.contribution.ts` - Register service, update imports
2. `src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts` - Add interactivity, inline detail
3. `src/vs/workbench/contrib/sys/browser/media/sysSemanticWorkbench.css` - Add new styles

## Non-Goals

The following were explicitly NOT implemented:

- Live `sys-platform` integration
- Governed-spec approval
- Code approval
- Proposal generation
- Proposal apply
- Source mutation
- Semantic inference
- LLM suggestions for unresolved intent
- Automatic business-rule completion
- CLI output parsing
- Ontology graph visualization
- Semantic diff for code proposals
- Source-evidence navigation
- SideX agent redesign
- IDE-wide rebranding

## Reuse

The implementation reuses existing SideX infrastructure:

1. **Storage:** `IStorageService`, `StorageScope`, `StorageTarget`
2. **DI:** `@IStorageService`, `@ISysSemanticSnapshotService` decorators
3. **Views:** `ViewPane`, `IViewPaneOptions`
4. **Events:** `Emitter`, `Event`
5. **DOM:** VS Code DOM utilities
6. **Theming:** VS Code theme variables
7. **Lifecycle:** `Disposable`, `InstantiationType`

## Future Considerations

### For v0.2

- Live integration with `sys-platform` governance
- Real-time sync with external authority
- Multi-project support
- Advanced validation

### For v1.0

- Full governance workflow
- Code generation from confirmed intent
- Team collaboration features
- Audit trail

## Conclusion

This implementation provides a clean, isolated human intent interaction workspace that:

1. Allows explicit human decisions without silent transformations
2. Maintains clear distinction between GUI state and governance state
3. Stores exact user text without inference
4. Provides explicit confirmation flows
5. Supports replacement with old/new comparison
6. Persists state deterministically
7. Follows existing SideX/VS Code patterns

The architecture is designed to be extended for future governance integration while maintaining the critical invariant: **the GUI never invents business meaning.**
