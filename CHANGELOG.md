# Changelog

All notable changes to `@honcho-ai/paperclip-honcho` will be documented in this file.

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
