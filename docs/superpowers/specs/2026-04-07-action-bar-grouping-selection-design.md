# Action Bar Grouping And Selection Design

## Summary

The Honcho settings page action bar currently renders all actions as a single flat set of peer buttons, and `Initialize memory for this company` is always styled as selected because it uses a fixed primary button style. This creates two UI problems:

1. Secondary and recovery-oriented actions look equally prominent to core setup actions.
2. The selected styling does not reflect the user's last interaction.

This change will keep all existing actions available, split them into `Core actions` and `Advanced actions`, and make the selected styling follow the last clicked action.

## Goals

- Keep the full action surface available in the settings page.
- Separate setup actions from advanced or recovery actions.
- Ensure selected styling represents the last clicked action.
- Preserve existing action behavior, notices, errors, and refresh logic.
- Add UI coverage for grouping and selection behavior.

## Non-Goals

- Changing worker-side action semantics.
- Removing any existing action from the UI.
- Introducing host-level tabs, accordions, or permission gates.
- Changing the success or failure messaging for actions.

## Current State

The action area in [`src/ui/index.tsx`](/Users/adavya/Downloads/paperclip-honcho/src/ui/index.tsx) renders each button inline with handwritten JSX. The initialize action is permanently rendered with the filled style, while other actions use secondary styles. There is no state that tracks which action was clicked most recently, and there is no grouping model that distinguishes common setup actions from advanced operations.

## Proposed Design

### Action Metadata

Replace the current handwritten action button block with a small action-definition list in the settings page component. Each action definition will include:

- `key`: stable identifier for styling and testing
- `label`: button text
- `group`: either `core` or `advanced`
- `disabled`: computed from the same existing conditions used today
- `run`: async handler that preserves current behavior

This keeps action rendering declarative and removes the current one-off primary styling.

### Grouped Rendering

Render the action panel as two labeled groups in this order:

1. `Core actions`
2. `Advanced actions`

`Core actions` will contain:

- `Save settings`
- `Validate config`
- `Test connection`
- `Initialize memory for this company`

`Advanced actions` will contain:

- `Rescan migration sources`
- `Import history`
- `Preview prompt context`
- `Repair mappings`

Each group will render its buttons in the existing wrap layout so the UI remains responsive without introducing a larger layout change.

### Selected State

Add local `selectedActionKey` state to the settings page component.

Behavior:

- No action is selected on first render.
- Clicking an enabled action sets `selectedActionKey` to that action's `key` before the async operation runs.
- The selected visual style is applied only when `selectedActionKey === action.key`.
- Selection is purely presentational and does not depend on success.
- If an action fails, it remains selected because it is still the last clicked action.
- Disabled actions cannot become selected because they cannot be invoked.

### Styling

Use one shared base button style plus a selected variant derived from component state. Remove the permanently filled initialize button style from the action bar. The selected appearance should remain visually equivalent to the current filled treatment so the semantics change without requiring a new visual language.

### Notices And Errors

All existing action handlers will keep their current behavior:

- `saveSettings` still saves configuration and refreshes memory status.
- `runValidation` still uses `settings.test`.
- `Test connection` still uses `testConnection`.
- Job-trigger actions still save settings first, trigger the relevant job, and refresh data.
- `Preview prompt context` and `Repair mappings` keep their current notice and error paths.

The change is limited to how actions are modeled and rendered in the UI.

## Testing

Add UI-focused tests that verify:

- the action panel renders separate `Core actions` and `Advanced actions` groups
- no action is visually selected on initial render
- clicking `Preview prompt context` marks that button as selected
- clicking another enabled action moves selected styling to the newly clicked button

Tests should avoid re-validating worker behavior already covered elsewhere and focus on the UI contract introduced by this change.

## Risks And Mitigations

### Risk: Selection styling becomes coupled to execution outcome

Mitigation: set selection before invoking the async handler and do not clear it in success or failure paths.

### Risk: Grouping refactor accidentally changes action enablement

Mitigation: reuse the existing disabled predicates directly in the action definitions and cover representative buttons in UI tests.

### Risk: Render refactor makes the panel harder to scan

Mitigation: keep the current button sizing and wrap behavior, adding only lightweight group labels.

## Implementation Outline

1. Add a data-driven action definition structure in the settings page component.
2. Add `selectedActionKey` state and selected-style resolution.
3. Render the actions in grouped sections with existing handlers wired through the action definitions.
4. Add or extend UI tests for grouping and last-click selection.

## Acceptance Criteria

- The settings page shows all current actions.
- The actions are visually separated into `Core actions` and `Advanced actions`.
- No button appears selected on first render.
- After clicking an action, that action is the only one shown as selected.
- Clicking `Preview prompt context` no longer leaves `Initialize memory for this company` styled as selected.
