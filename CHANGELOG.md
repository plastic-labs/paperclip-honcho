# Changelog

All notable changes to `@honcho-ai/paperclip-honcho` will be documented in this file.

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
