# Changelog

All notable changes to `@honcho-ai/paperclip-honcho` will be documented in this file.

## [0.1.2] - 2026-04-13

### Changed
- Issue sessions now use the Paperclip issue identifier for new Honcho session names so the Honcho dashboard shows the same task label operators see in Paperclip.
- Existing workspace and issue session mappings are now treated as canonical, preventing later `workspacePrefix` edits from silently remapping Honcho workspaces or sessions.
- Settings changes now autosave by default with a debounce while keeping explicit save and activation flows available.
- Migration preview now includes a per-issue mapping breakdown so operators can see which issues will contribute comments and documents before import.
- Workspace and agent peer IDs are now readable while remaining collision-safe through stable short hashed suffixes.

### Fixed
- Fixed `agent_profile_files` imports so they create and map agent peers instead of incorrectly falling through the owner peer path.
- Restored canonical agent peer IDs so Honcho peers consistently use the Paperclip agent ID instead of drifting to URL-key-based names.
- Fixed session and workspace lookup paths to honor persisted mappings, keeping reads, writes, and repair actions aligned with previously created Honcho resources.
- Fixed initialization so the selected company is prepared before `initialize-memory` runs, preventing settings-page success state from hanging on the wrong company.
- Fixed transient null Honcho responses so initialization and sync retry instead of crashing late.
- Fixed migration dedupe by checking existing Honcho session provenance once per session and backfilling the import ledger when prior appends already exist.
- Fixed readable workspace helper generation so `buildWorkspaceId(...)` matches canonical named workspace IDs.
- Fixed stable ID hashing to use `sha256` instead of `sha1`.
- Fixed future peer/session contamination by blocking stale workspace mapping reuse when the saved workspace does not match the current canonical workspace.

## [0.1.1] - 2026-04-10

### Added
- Improved self-hosted and local Honcho support, including local-mode configuration paths that can run without a configured API key when the target Honcho instance does not require one.
- Clearer release documentation for local previewing, tunneled localhost workflows, and the current Paperclip host limitations around direct local connectivity.

### Changed
- Simplified the settings experience into a cleaner operator flow with a dedicated `Save settings` action and a single `Initialize Honcho memory` action for validation, connection testing, setup, and import.
- Reduced the amount of unsupported or manual-only controls shown in the UI so the settings page better matches what the public Paperclip host can actually do.
- Refined plugin configuration naming around the Honcho API key and agent observation settings for a cleaner public config surface.
- Updated activation progress handling so long-running initialization jobs poll more realistically and do not look failed during normal execution.

### Fixed
- Fixed initialization status reporting so completed initialization no longer falls back to a misleading running/preview state after zero-item migrations.
- Fixed the activation button state so it only appears active while initialization is actually running.
- Fixed self-hosted credential handling so configured API keys are still forwarded to secured non-cloud Honcho deployments.
- Fixed settings normalization for saved Honcho secret refs so whitespace does not break the selected secret in the UI.

## [0.1.0] - 2026-04-01

### Added
- Initial public-host-compatible release of the Honcho memory plugin for Paperclip.
- Tool-first memory surface for issue, workspace, session, agent, search, and peer-recall flows.
- Honcho workspace, peer, and issue-session mapping from Paperclip entities.
- Issue comment sync and issue document sync with bounded sectioning.
- Operator UI for configuration, connection testing, migration scan/import, initialization, repair, and prompt preview.

### Changed
- Plugin manifest reduced to the latest public Paperclip capability surface so local-path installation works on upstream `paperclipai@0.3.1`.
- Prompt memory is now operator-driven instead of relying on unreleased automatic prompt-injection hooks.

### Fixed
- Local path install packaging now bundles the manifest correctly for runtime loading.
- Ingested message content is hard-capped before upload to Honcho to avoid oversized writes.
