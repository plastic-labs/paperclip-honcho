# Settings Page Action Bar And Prompt Context Removal Design

## Summary

The Honcho settings page currently has two UI problems:

1. The action bar renders core setup actions and secondary actions as a single flat set of peer buttons, and `Initialize memory for this company` is always styled as selected because it uses a fixed primary button style.
2. Prompt-context UI is shown even though prompt context should not be part of this settings page for now.

This change will split the remaining actions into `Core actions` and `Advanced actions`, make the selected styling follow the last clicked action, and remove prompt-context UI from the settings page entirely.

## Goals

- Keep the remaining supported action surface available in the settings page.
- Separate setup actions from advanced or recovery actions.
- Ensure selected styling represents the last clicked action.
- Remove prompt-context UI from the settings page for now.
- Preserve existing action behavior, notices, errors, and refresh logic.
- Add UI coverage for grouping, selection behavior, and prompt-context removal.

## Non-Goals

- Changing worker-side action semantics.
- Introducing host-level tabs, accordions, or permission gates.
- Changing the success or failure messaging for actions.
- Reworking prompt-context support elsewhere in the plugin.

## Current State

The action area in [`src/ui/index.tsx`](../../../src/ui/index.tsx) renders each button inline with handwritten JSX. The initialize action is permanently rendered with the filled style, while other actions use secondary styles. There is no state that tracks which action was clicked most recently, and there is no grouping model that distinguishes common setup actions from advanced operations.

The settings page also still exposes prompt-context UI even though prompt context should be manually reintroduced only when the Paperclip host catches up. Today that includes prompt-context copy, the prompt-context status pill, the `Preview prompt context` action, and the prompt-context configuration toggle.

## Proposed Design

### Action Metadata

Replace the current handwritten action button block with a small action-definition list in the settings page component. Each remaining action definition will include:

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
- `Repair mappings`

Each group will render its buttons in the existing wrap layout so the UI remains responsive without introducing a larger layout change.

### Prompt Context Removal

Remove prompt-context UI from the settings page entirely for now. Specifically, the page should no longer render:

- the `Prompt context: ...` status pill
- the `Preview prompt context` action
- the prompt-context settings toggle
- prompt-context descriptive copy in the settings-page messaging

This is an intentional product decision rather than a disabled state. Prompt context can be added back later when the host updates and the plugin is explicitly revised to support that surface again.

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

All remaining action handlers will keep their current behavior:

- `saveSettings` still saves configuration and refreshes memory status.
- `runValidation` still uses `settings.test`.
- `Test connection` still uses `testConnection`.
- Job-trigger actions still save settings first, trigger the relevant job, and refresh data.
- `Repair mappings` keeps its current notice and error paths.

The change is limited to how the settings-page UI is modeled and rendered.

## Testing

Add UI-focused tests that verify:

- the action panel renders separate `Core actions` and `Advanced actions` groups
- no action is visually selected on initial render
- clicking another enabled action moves selected styling to the newly clicked button
- prompt-context UI is absent from the settings page

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
3. Remove prompt-context UI elements and related settings-page copy.
4. Render the actions in grouped sections with existing handlers wired through the action definitions.
5. Add or extend UI tests for grouping, last-click selection, and prompt-context absence.

## Acceptance Criteria

- The settings page no longer shows prompt-context UI.
- The actions are visually separated into `Core actions` and `Advanced actions`.
- No button appears selected on first render.
- After clicking an action, that action is the only one shown as selected.
- `Initialize memory for this company` is not styled as selected on initial render.
